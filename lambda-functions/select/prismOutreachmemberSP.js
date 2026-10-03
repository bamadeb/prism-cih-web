const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//   user: conn.dbuser,
//   password: conn.dbpassword,
//   server: conn.dbhost,
//   database: conn.dbname,
//   port: 1433,
//   options: {
//     encrypt: true,
//     trustServerCertificate: true
//   },
//   pool: {
//     max: 20,
//     min: 1,
//     idleTimeoutMillis: 300000,
//     acquireTimeoutMillis: 10000
//   },
//   requestTimeout: 60000
// };

// // Create pool outside handler, once per container
// let connectionPoolPromise = sql.connect(config);

// async function getDBConnection() {
//   try {
//     return await connectionPoolPromise;
//   } catch (err) {
//     console.error("Reconnecting to SQL Server...", err.message);
//     connectionPoolPromise = sql.connect(config);
//     return await connectionPoolPromise;
//   }
// }


exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    try {
        // Hardcoded for now, later you can use event.queryStringParameters
        //event.user_id = '0'; 
        if (event.httpMethod === "OPTIONS") {
          return buildResponse(200,{},event);
        }
        const body = JSON.parse(event.body || "{}");
        let user_id = parseInt(body.user_id, 10);

        if (user_id === undefined || user_id === null || isNaN(user_id)) {
            return buildResponse(400,{ error: "Missing user_id" },event);
        }

        // Finding 3.3.10: this is the navigator's own dashboard data
        // (recentActivity, risk/quality summaries, referral list, etc.), but
        // user_id came straight from the client -- any authenticated caller
        // could pass another navigator's user_id and see their dashboard.
        // Admin may still request an arbitrary user_id; non-admins are
        // pinned to their own ID regardless of what was sent.
        const ADMIN_ROLE_ID = 7;
        const claims = event.requestContext?.authorizer?.claims || {};
        const callerSub = claims.sub;
        if (!callerSub) {
            return buildResponse(401, { error: "Unauthorized" }, event);
        }

        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { error: "Unauthorized" }, event);
        }
        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            user_id = Number(caller.ID);
        }
        const result = await pool
            .request()
            .input("user_id", sql.Int, user_id)
            //.execute("dashboardData");

            .execute("GetDashboardDataUpdateNew");
        // result.recordsets → array of 5 result sets
        const response = {
            //members: result.recordsets[0] || [],
            recentActivity: result.recordsets[0] || [],
            overallRiskQualitySummary: result.recordsets[1]?.[0] || {},
            ownRiskQualitySummary: result.recordsets[2]?.[0] || {},
            priorityAndOtherPerformanceSummary: result.recordsets[3] || [],             
            referralList: result.recordsets[4] || [],
            NoLongerPatientList: result.recordsets[5] || [],
            navigatorList: result.recordsets[6] || [],            
            planList: result.recordsets[7] || [],
            departmentList: result.recordsets[8] || []        
        };

        // return {
        //     statusCode: 200,
        //     data: response,
        // };
        return buildResponse(200,{data: response},event);
    } catch (error) {
        //console.error("Error in Lambda:", error);
        // return {
        //     statusCode: 500,
        //     body: JSON.stringify({ error: error.message || "Internal Server Error" }),
        // };
        return buildResponse(500,{ error: "Internal Server Error" },event);
    }
};