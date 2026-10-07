import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { createRequire } from "module";

// The /opt layers are CommonJS; createRequire lets this ESM handler load them.
const require = createRequire(import.meta.url);
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const client = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION
});

const ADMIN_ROLE_ID = 7;

// Matches the policy the frontend's own password field displays as a hint
// (adduser-dialog.html: "at least 15 characters long and include uppercase,
// lowercase, number, and special character") -- the frontend's actual
// Angular validator only enforces Validators.minLength(6), which doesn't
// match its own hint. Enforcing the real policy here so a password that
// slips past that under-enforced frontend check still gets rejected
// server-side instead of silently violating the stated policy.
const PASSWORD_POLICY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{15,}$/;

// Attributes this endpoint is allowed to change. custom:role (and any other
// custom:* attribute) is deliberately excluded -- those can drive
// authorization decisions elsewhere, so letting this endpoint set them
// arbitrarily would be a privilege-escalation path.
const ALLOWED_ATTRIBUTES = new Set(['given_name', 'family_name']);

export const handler = async (event) => {
  if (event?.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  // Finding 3.5.1-adjacent: this endpoint could reset ANY user's password or
  // rename them given just a username, with no check that the caller is an
  // admin or the account owner -- any logged-in caller could take over any
  // other account, including an admin's. Admin-only, same pattern as
  // prismCreateCognitoUser.js.
  const claims = event?.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { message: "Unauthorized" }, event);
  }

  try {
    const pool = await getDBConnection();
    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
      return buildResponse(403, { message: "Forbidden" }, event);
    }

    // CONFIRMED VIA LIVE TESTING (CloudWatch log showed "username is
    // required" even though the caller sent a username): this route was on a
    // non-proxy/custom API Gateway integration where the request fields land
    // directly on top-level `event`, NOT under event.body -- same as
    // prismProcessPCRdataSessionId.js. Handling both shapes so this isn't
    // fragile to which integration type actually fronts it.
    const body = event.body
      ? (() => { try { return JSON.parse(event.body); } catch { return {}; } })()
      : event;
    const { username, attributes, newPassword } = body;

    if (!username) {
      return buildResponse(400, { message: "username is required" }, event);
    }

    // -----------------------------
    // 1️⃣ Update User Attributes
    // -----------------------------
    if (attributes && typeof attributes === "object") {
      const UserAttributes = Object.keys(attributes)
        .filter((key) => ALLOWED_ATTRIBUTES.has(key))
        .map((key) => ({
          Name: key,
          Value: String(attributes[key]),
        }));

      if (UserAttributes.length > 0) {
        await client.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: username,
          UserAttributes,
        }));
      }
    }

    // -----------------------------
    // 2️⃣ Update Password
    // -----------------------------
    if (newPassword) {
      if (!PASSWORD_POLICY_RE.test(newPassword)) {
        return buildResponse(400, {
          message: "Password must be at least 15 characters and include uppercase, lowercase, a number, and a special character"
        }, event);
      }

      await client.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: username,
        Password: newPassword,
        Permanent: true
      }));
    }

    return buildResponse(200, { message: "User updated successfully" }, event);

  } catch (err) {
    // Log the real error server-side only -- don't echo raw SDK/exception
    // messages back to the caller.
    console.error("Error updating Cognito user:", err);
    return buildResponse(500, { error: "Internal server error" }, event);
  }
};
