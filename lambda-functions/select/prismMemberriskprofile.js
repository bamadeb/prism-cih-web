// handler.js
//'use strict';
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json'); // your config location
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// // DB config — tuned for connection reuse and Lambda
// const config = {
//   user: conn.dbuser,
//   password: conn.dbpassword,
//   server: conn.dbhost,
//   database: conn.dbname,
//   port: conn.dbport || 1433,
//   options: {
//     encrypt: true,
//     trustServerCertificate: true
//   },
//   pool: {
//     max: 10,
//     min: 0,
//     idleTimeoutMillis: 30000
//   },
//   // increase request timeout if necessary (ms)
//   requestTimeout: 30000
// };

// // Keep pool in module scope so Lambda can reuse between invocations
// let poolPromise = null;

// /**
//  * Return a connected pool (reused across Lambda invocations).
//  */
// async function getDBConnection() {
//   if (poolPromise) {
//     // if the previous pool was closed or failed, recreate
//     try {
//       const p = await poolPromise;
//       if (p.connected) return p;
//     } catch (e) {
//       // fall through to recreate
//       console.warn('Existing pool invalid — recreating', e && e.message);
//     }
//   }

//   // create and store the promise immediately to avoid concurrent creations
//   poolPromise = new sql.ConnectionPool(config)
//     .connect()
//     .then(pool => {
//       // optionally attach error listener
//       pool.on('error', err => {
//         console.error('SQL pool error', err);
//       });
//       return pool;
//     });

//   return poolPromise;
// }

/**
 * Lambda handler
 */
exports.handler = async (event, context) => {
  // IMPORTANT for connection reuse in Lambda
  context.callbackWaitsForEmptyEventLoop = false;

  // allow event to set user_id; keep it numeric or undefined
  const body = JSON.parse(event.body || "{}");
  let userId = (body && typeof body.user_id !== 'undefined' && body.user_id !== null)
    ? Number(body.user_id)
    : null;

  let pool;
  try {
    if (event.httpMethod === "OPTIONS") {
      return buildResponse(200,{},event);
    }

    // Finding 3.3.10: user_id came straight from the client with no check
    // that the caller is actually that navigator -- any authenticated
    // caller could pass another navigator's user_id, or omit it entirely to
    // get every navigator's risk data in one call. Admin may still pass an
    // arbitrary user_id or omit it (existing "all navigators" behavior);
    // non-admins are pinned to their own ID regardless of what was sent.
    const ADMIN_ROLE_ID = 7;
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { message: "Unauthorized" }, event);
    }

    pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { message: "Unauthorized" }, event);
    }
    if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
      userId = Number(caller.ID);
    }

    // Build parameterized riskSummary query. If userId is provided, include param
    const userFilterClause = userId ? ' AND mt.Care_Coordinator_id = @userId ' : '';

    // NOTE: FORMAT() removed for performance; using CONVERT to YYYY-MM like '2025-12'
    const riskSummaryQuery = `
      SELECT
        mt.Care_Coordinator_id,
        CONCAT(u.FistName, ' ', u.LastName) AS Care_Coordinator_name,
        mt.medicaid_id,
        CONCAT(m.FIRST_NAME, ' ', m.LAST_NAME) AS member_name,
        RC.risk_category,
        RS.sub_category_name,
        RS2.sub_category_id,
        RS2.id AS sub_category2_id,
        RS2.sub_category2_name,
        CONVERT(VARCHAR(7), MRS.to_date, 120) AS to_date,
        SUM(ISNULL(MRS.score,0)) AS score,
        rlm_out.level,
        newriskcategory.level as newriskcategory,
        maf1.action_date as last_action_date,
        (SELECT TOP 1 CONVERT(varchar(10), action_date, 101)
         FROM MEM_TASK_FOLLOW_UP
         WHERE medicaid_id = MT.medicaid_id
           AND [status] IN ('Open', 'In-Process')
         ORDER BY [action_date] ASC) AS next_upcoming_date
      FROM MEM_RISK_SCORE AS MRS
      LEFT JOIN RISK_SUBCATEGORY2 AS RS2 ON MRS.sub_category2_id = RS2.id
      LEFT JOIN RISK_SUBCATEGORY AS RS ON RS2.sub_category_id = RS.id
      LEFT JOIN RISK_CATEGORY AS RC ON RS.category_id = RC.id
      JOIN MEM_OUTREACH_MEMBERS AS mt ON CAST(MRS.member_id AS VARCHAR(50)) = mt.medicaid_id
      LEFT JOIN MEM_MEMBERS AS m ON mt.medicaid_id = m.RECIP_NO
      LEFT JOIN MEM_USERS AS u ON mt.Care_Coordinator_id = u.ID
      LEFT JOIN (
        SELECT medicaid_id, action_date, action_status
        FROM (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY medicaid_id ORDER BY action_date DESC) AS rn
          FROM MEM_MEMBER_ACTION_FOLLOW_UP
          WHERE action_status = 'Success'
        ) AS x
        WHERE rn = 1
      ) maf1 ON mt.medicaid_id = maf1.medicaid_id
      OUTER APPLY (
        SELECT TOP 1 rlm.level
        FROM RISK_LEVEL_MASTER AS rlm
        WHERE rlm.sub_category_id = RS2.id
          AND MRS.score BETWEEN rlm.range_from AND rlm.range_to
      ) AS rlm_out
       OUTER APPLY (
        SELECT TOP 1 level
        FROM RISK_LEVEL_MASTER
        WHERE MRS.score BETWEEN range_from AND range_to
		AND sub_category_id=0
      ) AS newriskcategory
      WHERE MRS.status = 0
        AND u.role_id = '9'
        ${userFilterClause}
      GROUP BY
        mt.Care_Coordinator_id,
        u.FistName,
        u.LastName,
        mt.medicaid_id,
        m.FIRST_NAME,
        m.LAST_NAME,
        RC.risk_category,
        RS.sub_category_name,
        RS2.sub_category_id,
        RS2.id,
        RS2.sub_category2_name,
        CONVERT(VARCHAR(7), MRS.to_date, 120),
        rlm_out.level,
        newriskcategory.level,
        maf1.action_date
      ORDER BY u.FistName, u.LastName, m.FIRST_NAME, m.LAST_NAME;
    `;

    const userlistQuery = `
      SELECT [ID], [FistName], [LastName]
      FROM MEM_USERS
      WHERE role_id='9' AND member_status='0'
      ORDER BY [FistName], [LastName];
    `;

    const riskLevelQuery = `
      SELECT [level], [range_from], [range_to]
      FROM RISK_LEVEL_MASTER
      WHERE [sub_category_id] = '0' AND [status] = '0'
      ORDER BY [ordering] DESC;
    `;

    // Combine queries into a single batch to reduce round trips.
    // The result will contain multiple recordsets in order.
    const combinedSql = `
      ${riskSummaryQuery}
      ${userlistQuery}
      ${riskLevelQuery}
    `;

    const request = pool.request();

    // Add parameter only if provided
    if (userId) {
      request.input('userId', sql.Int, userId);
    }

    // Execute the single batched query
    const result = await request.query(combinedSql);

    // result.recordsets is an array: [riskSummaryRows, userlistRows, riskLevelRows]
    const riskSummary = result.recordsets[0] || [];
    const userlist = result.recordsets[1] || [];
    const riskLevel = result.recordsets[2] || [];

    // return {
    //   statusCode: 200,
    //   data: {
    //     riskLevel,
    //     riskSummary,
    //     userlist
    //   }
    // };
    return buildResponse(200,{ data: {riskLevel: riskLevel,riskSummary: riskSummary,userlist: userlist }},event);
  } catch (err) {
    console.error('Database error:', err);
    // return {
    //   statusCode: 500,
    //   data: { error: 'Internal Server Error', details: err.message }
    // };
    return buildResponse(500,{ error: 'Internal Server Error' },event);
  }
};
