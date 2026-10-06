import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { createRequire } from "module";

// The /opt layers are CommonJS; createRequire lets this ESM handler load them.
const require = createRequire(import.meta.url);
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const USER_POOL_ID = process.env.USER_POOL_ID;
const REGION = process.env.COGNITO_REGION || "us-east-1";
const ADMIN_ROLE_ID = 7;

const client = new CognitoIdentityProviderClient({
  region: REGION
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Matches the policy the frontend's own password field displays as a hint
// (adduser-dialog.html: "at least 15 characters long and include uppercase,
// lowercase, number, and special character") -- the frontend's actual
// Angular validator only enforces Validators.minLength(6), which doesn't
// match its own hint. Enforcing the real policy here.
const PASSWORD_POLICY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{15,}$/;

export const handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return buildResponse(200, {}, event);
    }

    // Do not log the raw event -- it contains the plaintext password from
    // the request body and would otherwise land in CloudWatch logs.
    console.log("📥 Received createCognitoUser request");

    // Finding 3.5.1 follow-up: this endpoint creates a real, login-capable
    // account (optionally with an admin custom:role attribute) and had no
    // check that the caller is an admin -- any authenticated user could call
    // it directly, since API Gateway only requires a valid Cognito JWT, not a
    // specific role.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { message: "Unauthorized" }, event);
    }

    const authPool = await getDBConnection();
    const callerLookup = await authPool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
      return buildResponse(403, { message: "Forbidden" }, event);
    }

    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event;

    const {
      email,
      firstName,
      lastName,
      password,
      role // optional
    } = body;

    if (!email || !password) {
      return buildResponse(400, { message: "Email and Password are required" }, event);
    }

    if (!EMAIL_RE.test(email)) {
      return buildResponse(400, { message: "Invalid email address" }, event);
    }

    if (!PASSWORD_POLICY_RE.test(password)) {
      return buildResponse(400, { message: "Password must be at least 15 characters and include uppercase, lowercase, a number, and a special character" }, event);
    }

    // role feeds into a Cognito custom attribute below -- restrict it to a
    // plain numeric id (matching MEM_USERS.role_id) rather than accepting an
    // arbitrary string, since custom:role may be read elsewhere for
    // authorization decisions.
    if (role !== undefined && role !== null && role !== '' && !/^\d+$/.test(String(role))) {
      return buildResponse(400, { message: "Invalid role" }, event);
    }

    const createResult = await client.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      TemporaryPassword: password,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "given_name", Value: firstName || "" },
        { Name: "family_name", Value: lastName || "" }
      ]
    }));
    console.log("✅ AdminCreateUser success");
    const cognitoUsername = createResult.User?.Username;

    await client.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    }));
    console.log("🔐 Password set permanently");

    if (role) {
      await client.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: "custom:role", Value: String(role) }
        ]
      }));
      console.log("🎯 custom:role added:", role);
    }

    return buildResponse(200, {
      status: "success",
      message: "User created successfully in Cognito",
      user: { email, firstName, lastName, role, cognitoUsername }
    }, event);

  } catch (error) {
    // Finding 3.5.1: error.message (which can include raw AWS SDK/Cognito
    // error text) was echoed straight back to the caller. Log it server-side
    // only and return a generic message.
    console.error("❌ Error creating Cognito user:", error);

    return buildResponse(500, {
      status: "error",
      message: "Cognito user creation failed"
    }, event);
  }
};
