const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

// Finding 3.2.1: username came straight from the client with no ownership
// check, so any authenticated caller could clear ANY account's failed-login
// lockout counter.
//
// REVERTED an ownership check that required event.requestContext.authorizer.
// claims.sub: confirmed via live testing that this route is called right
// after prismAuthentication.js succeeds, BEFORE the frontend has a Cognito
// bearer token to attach -- there is no API Gateway Cognito authorizer on
// this route (same underlying gap the pentest report calls out for the
// account lock/unlock endpoints). Enforcing ownership here isn't possible
// from application code alone until that infra gap is addressed; fixing it
// needs a login-flow-aware approach (e.g. a short-lived server-issued token
// scoped to "just logged in as this username"), not a blind claims check.
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

    pool = await getDBConnection();

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
