// Lambda: createCognitoUser.mjs
// Node.js 18+ (ESM import version)

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand
} from "@aws-sdk/client-cognito-identity-provider";

// Environment Variables
const USER_POOL_ID = process.env.USER_POOL_ID;
const REGION = process.env.COGNITO_REGION || "us-east-1";

// Cognito Client
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
    // Do not log the raw event -- it contains the plaintext password from
    // the request body and would otherwise land in CloudWatch logs.
    console.log("📥 Received createCognitoUser request");

    // TODO(authorization): this endpoint creates a real, login-capable
    // account and currently has no check that the caller is an admin. Wire
    // in a role check here once the auth-claims shape reaching this Lambda
    // is confirmed (e.g. event.requestContext.authorizer.claims).

    // Parse JSON body safely
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
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Email and Password are required" })
      };
    }

    if (!EMAIL_RE.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid email address" })
      };
    }

    if (!PASSWORD_POLICY_RE.test(password)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Password must be at least 15 characters and include uppercase, lowercase, a number, and a special character" })
      };
    }

    // role feeds into a Cognito custom attribute below -- restrict it to a
    // plain numeric id (matching MEM_USERS.role_id) rather than accepting an
    // arbitrary string, since custom:role may be read elsewhere for
    // authorization decisions.
    if (role !== undefined && role !== null && role !== '' && !/^\d+$/.test(String(role))) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid role" })
      };
    }

    // ------------------------------
    // 1️⃣ CREATE COGNITO USER
    // ------------------------------
    const createUserCmd = new AdminCreateUserCommand({
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
    });

    const createResult = await client.send(createUserCmd);
    console.log("✅ AdminCreateUser success");
    const cognitoUsername = createResult.User?.Username;
    // ------------------------------
    // 2️⃣ SET PERMANENT PASSWORD
    // ------------------------------
    const passwordCmd = new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    });

    await client.send(passwordCmd);
    console.log("🔐 Password set permanently");

    // ------------------------------
    // 3️⃣ OPTIONAL: UPDATE ROLE ATTRIBUTE
    // ------------------------------
    if (role) {
      const updateAttrCmd = new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: "custom:role", Value: String(role) }
        ]
      });

      await client.send(updateAttrCmd);
      console.log("🎯 custom:role added:", role);
    }

    // ------------------------------
    // SUCCESS RESPONSE
    // ------------------------------
    return {
      statusCode: 200,
      data: JSON.stringify({
        status: "success",
        message: "User created successfully in Cognito",
        user: { email, firstName, lastName, role, cognitoUsername }
      })
    };

  } catch (error) {
    console.error("❌ Error creating Cognito user:", error);

    return {
      statusCode: 500,
      data: JSON.stringify({
        status: "error",
        message: error.message || "Cognito user creation failed"
      })
    };
  }
};
