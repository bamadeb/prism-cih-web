const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }
  const body = JSON.parse(event.body || '{}');
  let medicaid_id = body.medicaid_id;

  // Finding: member PHI (language) for ANY medicaid_id with no ownership
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
      .input('medicaid_id', sql.VarChar, medicaid_id) // Ensure it's treated as a string
      .query(`SELECT m.PRIMARY_LANG,r_lang.LANGUAGE_DESC
            FROM MEM_MEMBERS as m 
            JOIN [dm].[R_LANGUAGE] as r_lang ON(m.PRIMARY_LANG=r_lang.LANGUAGE_CD) 
            WHERE m.RECIP_NO= @medicaid_id `); // Correct usage of parameter

    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    return buildResponse(500, { message: 'Internal server error' }, event);
  } finally {
    if (pool) await pool.close();
  }
};
