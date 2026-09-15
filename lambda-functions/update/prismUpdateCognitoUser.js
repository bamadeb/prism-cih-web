import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION
});

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
  // TODO(authorization): this endpoint can reset ANY user's password given
  // just a username, with no check that the caller is an admin or the
  // account owner. Wire in a role/identity check here once the auth-claims
  // shape reaching this Lambda is confirmed (e.g.
  // event.requestContext.authorizer.claims).

  try {
    // Every other Lambda behind this API parses JSON.parse(event.body) --
    // reading top-level event.username/event.attributes here means, behind
    // API Gateway proxy integration, those are always undefined and this
    // handler always throws "username is required". Fixed to match the
    // other handlers' parsing.
    const body = JSON.parse(event.body || "{}");
    const { username, attributes, newPassword } = body;

    if (!username) {
      throw new Error("username is required");
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
        const updateCommand = new AdminUpdateUserAttributesCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: username,
          UserAttributes,
        });

        await client.send(updateCommand);
      }
    }

    // -----------------------------
    // 2️⃣ Update Password
    // -----------------------------
    if (newPassword) {
      if (!PASSWORD_POLICY_RE.test(newPassword)) {
        return {
          statusCode: 400,
          message: "Password must be at least 15 characters and include uppercase, lowercase, a number, and a special character"
        };
      }

      const passCommand = new AdminSetUserPasswordCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: username,
        Password: newPassword,
        Permanent: true  // Password will not expire
      });

      await client.send(passCommand);
    }

    return {
      statusCode: 200,
      message: "User updated successfully"
    };

  } catch (err) {
    // Log the real error server-side only -- don't echo raw SDK/exception
    // messages back to the caller.
    console.error("Error updating Cognito user:", err);
    return {
      statusCode: 500,
      error: "Internal server error"
    };
  }
};
