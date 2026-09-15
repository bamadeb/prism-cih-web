import {
  CognitoIdentityProviderClient,
  AdminEnableUserCommand
} from "@aws-sdk/client-cognito-identity-provider";

// Env
const USER_POOL_ID = process.env.USER_POOL_ID;
const REGION = process.env.COGNITO_REGION || "us-east-1";

// Client
const client = new CognitoIdentityProviderClient({
  region: REGION
});

export const handler = async (event) => {
  // TODO(authorization): this is an admin-only action (unlocking ANY user's
  // account) but nothing here checks that the caller actually has admin
  // rights -- it only checks that a username was provided. Wire in a role
  // check here once the auth-claims shape reaching this Lambda is confirmed
  // (e.g. event.requestContext.authorizer.claims), and add an audit log
  // entry recording which admin unlocked which account.

  try {
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

    // 🔓 Enable user
    const command = new AdminEnableUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username
    });

    await client.send(command);

    console.log("🔓 User enabled:", username);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "success",
        message: "User unlocked successfully",
        username
      })
    };

  } catch (error) {
    // Log the real error server-side only -- don't echo raw SDK/exception
    // messages back to the caller.
    console.error("❌ Enable error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: "Failed to unlock user"
      })
    };
  }
};