const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, {}, event);
  }
  const body = JSON.parse(event.body || '{}');
  const medicaid_id = body.medicaid_id;

  // Finding (IDOR): medicaid_id was optional -- omitting it returned every
  // plan-member/benefit row in the system to any caller. Now required, and
  // non-admins must be that member's assigned care coordinator.
  if (!medicaid_id) {
    return buildResponse(400, { error: 'medicaid_id is required' }, event);
  }

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

    const request = pool.request();
    request.input('medicaid_id', sql.VarChar(20), medicaid_id);
    const query = `SELECT distinct M.plan_name
                ,CONVERT(VARCHAR,M.start_date,101) as start_date
                ,CONVERT(VARCHAR,M.end_date,101) as end_date
                ,PM.plan_id
                ,MA.attachment as file_name
            FROM MEM_PLAN_MEMBERS as PM
            LEFT JOIN MEM_PLAN_MASTER as M ON PM.plan_id=M.id
            LEFT JOIN MEM_ATTACHMENT AS MA ON PM.plan_id=MA.type_id AND MA.status='0' AND MA.type='plan'
            WHERE PM.status='0' AND PM.medicaid_id = @medicaid_id`;

    const result = await request.query(query);
    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    return buildResponse(500, { error: 'Internal Server Error' }, event);
  }
};
