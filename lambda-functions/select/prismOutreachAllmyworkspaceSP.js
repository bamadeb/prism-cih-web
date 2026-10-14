const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  try {
    // Hardcoded for now, later you can use event.queryStringParameters
    // event.user_id = '1';
    //let user_id = parseInt(event.user_id, 10);
    const body = JSON.parse(event.body || '{}');
    const user_id = body.user_id;

    if (user_id === undefined || user_id === null || isNaN(user_id)) {
      // Finding: this raw response bypasses buildResponse, so it carries no
      // CORS headers -- a browser can't even read this validation error.
      return buildResponse(400, { error: 'Missing user_id' }, event);
    }

    // Finding: full workspace dashboard for ANY user_id with no check that
    // it's the caller's own. Non-admins are pinned to their own ID; Admins
    // may view any navigator's dashboard. Same pattern as
    // prismActionMasterData.js (the sibling this duplicates).
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { error: 'Unauthorized' }, event);
    }

    const pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { error: 'Unauthorized' }, event);
    }
    if (Number(caller.role_id) !== ADMIN_ROLE_ID && Number(user_id) !== Number(caller.ID)) {
      return buildResponse(403, { error: 'Forbidden' }, event);
    }

    const result = await pool
      .request()
      .input('user_id', sql.Int, user_id)
      .execute('GetDashboardDataUpdate');

    // result.recordsets → array of 5 result sets
    const response = {
      members: result.recordsets[0] || [],
      recentActivity: result.recordsets[1] || [],
      overallRiskQualitySummary: result.recordsets[2]?.[0] || {},
      ownRiskQualitySummary: result.recordsets[3]?.[0] || {},
      priorityAndOtherPerformanceSummary: result.recordsets[4] || [],
      departmentList: result.recordsets[5] || [],
      referralList: result.recordsets[6] || [],
      planList: result.recordsets[7] || [],
      NoLongerPatientList: result.recordsets[8] || [],
    };

    // return {
    //     statusCode: 200,
    //     data: response,
    // };
    return buildResponse(200, { data: response }, event);
  } catch (error) {
    console.error('Error in Lambda:', error);
    // return {
    //     statusCode: 500,
    //     body: JSON.stringify({ error: error.message || "Internal Server Error" }),
    // };
    return buildResponse(500, { error: 'Internal Server Error' }, event);
  }
};
