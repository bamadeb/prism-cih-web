const { buildResponse } = require('/opt/responseHelper');

const REFRESH_COOKIE_NAME = 'prism_refresh_token';
// Matches Cognito's default refresh token validity (30 days) so the cookie
// doesn't expire before the token it holds would anyway.
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Finding 3.4.3: the refresh token used to be written to localStorage,
// readable by any script on the page (e.g. via XSS) for its full ~30-day
// validity. This endpoint is called once, right after login, with the
// refresh token the browser just received directly from Cognito -- it
// stores it as an httpOnly cookie and the browser never reads it again.
// Only prismRefreshSession.js (also httpOnly-cookie-only) can read it back.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }

  // Cognito_Dev authorizer required at the API Gateway level -- only a
  // caller holding a freshly-issued, valid ID token (i.e. one that just
  // completed login) may store a refresh token here.
  const claims = event.requestContext?.authorizer?.claims || {};
  if (!claims.sub) {
    return buildResponse(401, { error: 'Unauthorized' }, event);
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return buildResponse(400, { error: 'Invalid JSON' }, event);
  }

  const refreshToken = body.refreshToken;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return buildResponse(400, { error: 'refreshToken is required' }, event);
  }

  const response = buildResponse(200, { status: 'ok' }, event);
  response.headers['Set-Cookie'] =
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${REFRESH_COOKIE_MAX_AGE_SECONDS}`;
  return response;
};
