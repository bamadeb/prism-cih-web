import {
  CognitoIdentityProviderClient,
  AdminEnableUserCommand
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

// Finding 3.3.6: unlocking any account had no authentication or role check.
// API Gateway's Cognito authorizer supplies the caller's verified claims; the
// caller must also be an Admin in MEM_USERS. Only Admin can unlock accounts.
export const handler = async (event) => {
  if (event?.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  try {
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { message: "Unauthorized" }, event);
    }

    const pool = await getDBConnection();
    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
      return buildResponse(403, { message: "Forbidden" }, event);
    }

    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event;

    const { username } = body;

    if (!username) {
      return buildResponse(400, { message: "Username is required" }, event);
    }

    await client.send(new AdminEnableUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username
    }));

    console.log("🔓 User enabled:", username);

    return buildResponse(200, {
      status: "success",
      message: "User unlocked successfully",
      username
    }, event);

  } catch (error) {
    console.error("❌ Enable error:", error);
    return buildResponse(500, {
      status: "error",
      message: "Failed to unlock user"
    }, event);
  }
};
