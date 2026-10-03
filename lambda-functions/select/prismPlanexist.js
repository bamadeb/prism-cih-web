const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// var conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser, 
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433, 
//     options: {
//         encrypt: true,
//         trustServerCertificate: true
//     }
// };

// let poolPromise;

// async function getDBConnection() {
//     if (!poolPromise) {
//         poolPromise = sql.connect(config);
//     }
//     return poolPromise;
// }

// Finding 3.3.10: medicaid_id/plan_id were both optional, so omitting them
// returned EVERY member's plan-enrollment record in one call, and even when
// supplied there was no check that the caller is that member's assigned
// care coordinator. Admin bypasses.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
      }
      const body = JSON.parse(event.body || "{}");
    var medicaid_id = body.medicaid_id;
    var plan_id = body.plan_id;

    if (!medicaid_id || typeof plan_id === 'undefined' || isNaN(plan_id)) {
        return buildResponse(400, { message: 'medicaid_id and a valid plan_id are required' }, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    try {
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { message: 'Unauthorized' }, event);
        }

        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            const assignmentLookup = await pool.request()
                .input('medicaid_id', sql.VarChar(20), medicaid_id)
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                return buildResponse(403, { message: 'Forbidden' }, event);
            }
        }

        const request = pool.request();

        const query = `
            SELECT
                [id],
                [plan_id],
                [medicaid_id],
                [added_by],
                [added_date],
                [status]
            FROM MEM_PLAN_MEMBERS
            WHERE status = '0'
              AND medicaid_id = @medicaid_id AND plan_id = @plan_id
        `;

        request.input('medicaid_id', sql.VarChar(20), medicaid_id);
        request.input('plan_id', sql.Int, parseInt(plan_id, 10));

        const result = await request.query(query);

        // return {
        //     statusCode: 200,
        //     data: result.recordset,
        // };
        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: err.message }),
        // };
        return buildResponse(500,{ error: "", message: "Internal Server Error" },event);
    }
};