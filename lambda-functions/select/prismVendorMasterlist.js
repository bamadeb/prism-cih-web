
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }

  const body = JSON.parse(event.body || '{}');

  // Finding 3.3.10: no auth check at all. This is reference/lookup data
  // (vendor list, not member-specific), so only a baseline
  // "must be a real logged-in user" check is needed -- no ownership scope.
  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { message: 'Unauthorized' }, event);
  }

  try {
    const pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
    if (!callerLookup.recordset[0]) {
      return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    const result = await pool
      .request()
      .query(`SELECT distinct [VENDOR_NUM]
                    ,[LAST_NAME] 
                    ,[ABBR]      
                FROM dm.[VENDOR]
                WHERE [ROW_STATUS_CD] ='0'`);

    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    return buildResponse(500, { error: 'Internal server error' }, event);
  }
};
