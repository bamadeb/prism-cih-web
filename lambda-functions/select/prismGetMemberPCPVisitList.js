const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }
  const body = JSON.parse(event.body || "{}");
  const medicaid_id = body.medicaid_id;
  if (!medicaid_id) {
    return buildResponse(400, { error: 'medicaid_id is required' }, event);
  }

  // Finding (IDOR): no check that a non-admin caller is this member's
  // assigned care coordinator.
  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { error: 'Unauthorized' }, event);
  }

  try {
    const pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { error: 'Unauthorized' }, event);
    }

    if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
      const assignmentLookup = await pool.request()
        .input('medicaid_id', sql.VarChar, medicaid_id)
        .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
      const member = assignmentLookup.recordset[0];
      if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
        return buildResponse(403, { error: 'Forbidden' }, event);
      }
    }

    const result = await pool
      .request()
      .input('medicaid_id', sql.VarChar, medicaid_id)
      .query(`
        SELECT
          mpv.ID,
          mpv.MEDICAID_ID,
          CONVERT(VARCHAR, mpv.VISIT_DATE, 101) AS VISIT_DATE,
          mpv.VISIT_TYPE,
          mpt.PCP_TYPE,
          mpv.MESSAGE,
          mpv.ADDED_DATE,
          mpv.ADDED_BY,
          CONCAT(u.FistName, ' ', u.LastName) AS added_user_name
        FROM MEM_MEMBER_PCP_VISIT AS mpv
        LEFT JOIN MEM_USERS AS u ON mpv.ADDED_BY = u.ID
        LEFT JOIN MST_PCP_TYPE as mpt ON mpv.VISIT_TYPE =mpt.ID
        WHERE mpv.MEDICAID_ID = @medicaid_id
        ORDER BY mpv.VISIT_DATE DESC
      `);

    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database error:', err);
    return buildResponse(500, { error: "Internal Server Error" }, event);
  }
};
