const { buildResponse } = require('/opt/responseHelper');

const REFRESH_COOKIE_NAME = 'prism_refresh_token';

// Called on logout. An httpOnly cookie can't be cleared from browser JS, so
// this is the only way to actually end the server-side-recognized session;
// clearing localStorage/sessionStorage alone (as logout() already did)
// leaves the refresh-token cookie valid until Cognito's own ~30-day expiry.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }

  const response = buildResponse(200, { status: 'ok' }, event);
  response.headers['Set-Cookie'] =
    `${REFRESH_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
  return response;
};
