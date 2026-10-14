const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200,{},event);
  }
  // var diag_code = event.diag_code;
  // var action_id = event.action_id;
  // var medicaid_id = event.medicaid_id;

  const body = JSON.parse(event.body || '{}');
  const diag_code = body.diag_code;
  const action_id = body.action_id;
  const medicaid_id = body.medicaid_id;
  //var id = '1134';

  // var filter_sql = "";
  // if (typeof user_id !== 'undefined') {
  //     filter_sql += " AND U.EmailID='"+username+"' AND U.Password='"+password+"' ";
  // }

  // Finding: this is a WRITE endpoint (resets a risk-gap status) for ANY
  // medicaid_id with no ownership check, AND built the UPDATE via raw string
  // concatenation of action_id/medicaid_id (SQL injection). Admin bypasses
  // the ownership check; the query is now fully parameterized.
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
    if (!caller) {
      return buildResponse(401, { error: 'Unauthorized' }, event);
    }

    if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
      const assignmentLookup = await pool.request()
        .input('medicaid_id', sql.VarChar, String(medicaid_id))
        .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
      const member = assignmentLookup.recordset[0];
      if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
        return buildResponse(403, { error: 'Forbidden' }, event);
      }
    }

    const result = await pool
      .request()
      .input('action_id', sql.VarChar, action_id)
      .input('medicaid_id', sql.VarChar, medicaid_id)
      .query(`
        UPDATE g SET g.PROCESS_STATUS='0',g.UPDATE_DATE=GETDATE(),g.ACTION_ID=@action_id
        FROM MEM_MEMBERS AS m LEFT JOIN MEM_RISK_GAP as g ON(m.SUBSCRIBER_NUMBER=g.SUBSCRIBER_NUMBER)
        WHERE m.RECIP_NO = @medicaid_id AND g.PROCESS_STATUS='1'
      `);

    // return {
    //     statusCode: 200,
    //     data: result.recordset,
    // };
    return buildResponse(200, { data: result.recordset }, event);
  } catch (err) {
    console.error('Database connection error:', err);
    // return {
    //     statusCode: 500,
    //     data: JSON.stringify({ error: err.message }),
    // };
    return buildResponse(500, { error: 'Internal Server Error' }, event);
  }
};
