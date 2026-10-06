const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

// Finding 3.2.1: username came straight from the client with no ownership
// check, so any authenticated caller could clear ANY account's failed-login
// lockout counter.
//
// An earlier attempt at this fix was reverted after live testing showed the
// Cognito authorizer wasn't attached to this route yet, making claims.sub
// always empty and 401-ing every caller. Since confirmed (via API Gateway
// Method Request) that Cognito_Dev is now attached to this route, re-applying
// the ownership check. Non-admins may only reset their own account.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const username = body.username;
  let pool;
  try {
    if (event.httpMethod === 'OPTIONS') {
      return buildResponse(200, {}, event);
    }
    if (!username) {
      return buildResponse(400, { error: 'username is required' }, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { error: 'Unauthorized' }, event);
    }

    pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id, EmailID FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { error: 'Unauthorized' }, event);
    }

    if (Number(caller.role_id) !== ADMIN_ROLE_ID &&
        String(caller.EmailID).toLowerCase() !== String(username).toLowerCase()) {
      return buildResponse(403, { error: 'Forbidden' }, event);
    }

    const result = await pool
      .request()
      .input('username', sql.VarChar, username) // Ensure it's treated as a string
      .query(`UPDATE USER_LOGIN_ATTEMPTS
                SET FAILED_ATTEMPTS = 0,
                    LOCKED = 0,
                    LOCKED_AT = NULL,
                    UPDATED_AT = GETDATE()
                WHERE USERNAME = @username`); // Correct usage of parameter

    // return {
    //     statusCode: 200,
    //     data: result.recordset,
    // };
    return buildResponse(200, { rowsAffected: result.rowsAffected }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    // return {
    //     statusCode: 500,
    //     data: JSON.stringify({ error: err.message }),
    // };
    return buildResponse(500, { error: 'Interna server error.' }, event);
  } finally {
    //if (pool) await pool.close();
  }
};
