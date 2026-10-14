const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }

  const body = JSON.parse(event.body || '{}');
  const user_id = body.user_id;

  // Finding: this listed every user's row -- including the bcrypt Password
  // hash column -- to ANY authenticated caller, with no auth check at all,
  // and built the WHERE clause via raw string concatenation of user_id (SQL
  // injection). Admin-only now (matches prismUserslist.js's established
  // fix); Password column dropped entirely -- no legitimate caller needs it,
  // and it should never be returned to the client.
  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { error: 'Unauthorized' }, event);
  }

  let pool;
  try {
    pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
      return buildResponse(403, { error: 'Forbidden' }, event);
    }

    const request = pool.request();
    let whereClause = '';
    if (typeof user_id !== 'undefined') {
      request.input('user_id', sql.Int, user_id);
      whereClause = ' WHERE ID = @user_id';
    }

    const result = await request.query(`SELECT  [ID]
        ,[cognito_username]
        ,[company_id]
        ,[role_id]
        ,[initial]
        ,[department_id]
        ,[parent_id]
        ,[title]
        ,[FistName]
        ,[LastName]
        ,[EmailID]
        ,[Phone]
        ,[member_role]
        ,[action_type]
        ,[language]
        ,[add_date]
        ,[member_status]
        ,[ward]
        ,[zipcode]
        ,[race]
        ,[max_load]
        ,[department]
        ,[patientID]
        ,[plan]
        ,[profile_image]
        ,[medicaid_id]
        ,[image]
    FROM MEM_USERS` + whereClause);

    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    return buildResponse(500, { error: 'Internal server error' }, event);
  } finally {
    if (pool) await pool.close();
  }
};
