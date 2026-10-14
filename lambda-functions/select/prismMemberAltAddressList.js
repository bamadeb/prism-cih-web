
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }
  const body = JSON.parse(event.body || '{}');
  var medicaid_id = body.medicaid_id;
  //medicaid_id = '0010143576';

  // Finding: member PHI (address) for ANY medicaid_id with no ownership
  // check. Admin bypasses, same pattern as prismMemberhistory.js.
  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { message: 'Unauthorized' }, event);
  }

  let pool;
  try {
    pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
      const assignmentLookup = await pool.request()
        .input('medicaid_id', sql.VarChar, String(medicaid_id))
        .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
      const member = assignmentLookup.recordset[0];
      if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
        return buildResponse(403, { message: 'Forbidden' }, event);
      }
    }

    const result = await pool
      .request()
      .input('medicaid_id', sql.VarChar(20), medicaid_id)
      .query(`SELECT A.* FROM(
SELECT   '' AS id,
    RECIP_NO AS medicaid_id,
    OTHER_ADDR1 AS alt_address,
	'' AS alt_city,
	'' AS alt_state,
	'' AS alt_zip,
    '' AS add_date,
    '' AS add_by,
    '' AS FistName,
    '' AS LastName,
    '(ROSTER)' AS initial
FROM  MEM_MEMBERS
WHERE RECIP_NO = @medicaid_id
UNION ALL
SELECT AP.[id]
  ,AP.[medicaid_id]
  ,AP.[alt_address]
  ,AP.[alt_city]
  ,AP.[alt_state]
  ,AP.[alt_zip]
  ,CONVERT(VARCHAR, AP.[add_date], 101) AS add_date
  ,AP.[add_by]
  ,US.FistName, US.LastName,US.FistName as initial
FROM MEM_ALT_ADDRESS AS AP
JOIN MEM_USERS AS US ON (AP.add_by = US.ID) 
WHERE AP.medicaid_id = @medicaid_id) AS A 
ORDER BY id ASC`);

    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    return buildResponse(500, { message: 'Internal server error' }, event);
  }
};
