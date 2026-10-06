const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { buildResponse } = require('/opt/responseHelper');

const REFRESH_COOKIE_NAME = 'prism_refresh_token';
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const REGION = process.env.COGNITO_REGION || 'us-east-2';

const client = new CognitoIdentityProviderClient({ region: REGION });

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function clearCookieHeader() {
  return `${REFRESH_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}

// Finding 3.4.3: this is the only place the refresh token's actual value is
// ever read. It's pre-auth by design -- refreshing is exactly what happens
// once the access/ID token has already expired, so there is no valid JWT to
// require here. The httpOnly cookie (never readable by browser JS) is
// itself the credential, validated by Cognito's own REFRESH_TOKEN_AUTH flow.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }

  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
  const cookies = parseCookies(cookieHeader);
  const refreshToken = cookies[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    return buildResponse(401, { error: 'No session' }, event);
  }

  try {
    const result = await client.send(new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken }
    }));

    const tokens = result.AuthenticationResult;
    if (!tokens) {
      const response = buildResponse(401, { error: 'Session expired' }, event);
      response.headers['Set-Cookie'] = clearCookieHeader();
      return response;
    }

    const response = buildResponse(200, {
      accessToken: tokens.AccessToken,
      idToken: tokens.IdToken,
      expiresIn: tokens.ExpiresIn
    }, event);

    // Cognito doesn't rotate the refresh token on REFRESH_TOKEN_AUTH -- it's
    // re-set here only to slide the cookie's own Max-Age forward.
    response.headers['Set-Cookie'] =
      `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${REFRESH_COOKIE_MAX_AGE_SECONDS}`;
    return response;

  } catch (err) {
    console.error('Refresh session error:', err);
    // Only an invalid/expired/revoked refresh token should end the session.
    // Any other failure (missing env var, IAM denial, Cognito outage) is a
    // server problem and must not log the user out.
    if (err.name === 'NotAuthorizedException') {
      const response = buildResponse(401, { error: 'Session expired' }, event);
      response.headers['Set-Cookie'] = clearCookieHeader();
      return response;
    }
    return buildResponse(500, { error: 'Session refresh failed' }, event);
  }
};
