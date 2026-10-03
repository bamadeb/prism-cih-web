import {
  CognitoIdentityProviderClient,
  AdminDisableUserCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { createRequire } from "module";

// The /opt/dbConfig layer is CommonJS; createRequire lets this ESM handler
// load it without relying on static named-export detection.
const require = createRequire(import.meta.url);
const { getDBConnection, sql } = require('/opt/dbConfig');

// Env
const USER_POOL_ID = process.env.USER_POOL_ID;
const REGION = process.env.COGNITO_REGION || "us-east-1";
const ADMIN_ROLE_ID = 7;

// Client
const client = new CognitoIdentityProviderClient({
  region: REGION
});

export const handler = async (event) => {
  try {
    // Finding 3.1.6: locking/disabling ANY user's account had no auth check
    // at all -- only that a username was supplied. If this route turns out to
    // have no Cognito authorizer attached at the API Gateway level (checked
    // the same way prismGetcallhistory-prod's "CognitoProd" authorizer was
    // confirmed), that's a separate infra fix needed alongside this one.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    const pool = await getDBConnection();
    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
      return { statusCode: 403, body: JSON.stringify({ message: "Forbidden" }) };
    }

    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event;

    const { username } = body;

    if (!username) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Username is required"
        })
      };
    }

    // 🔒 Disable user
    const command = new AdminDisableUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username
    });

    await client.send(command);

    console.log("🔒 User disabled:", username);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: "User disabled successfully",
        username
      })
    };

  } catch (error) {
    console.error("❌ Disable error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: error.message || "Failed to disable user"
      })
    };
  }
};