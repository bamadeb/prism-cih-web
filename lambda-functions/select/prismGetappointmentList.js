const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// var conn = require('/opt/config.json')
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
//     },
//     pool: {
//       max: 10,
//       min: 1,
//       idleTimeoutMillis: 300000,
//       acquireTimeoutMillis: 10000
//     }
// };

// let connectionPool;

// async function getDBConnection() {
//     try {
//         if (!connectionPool || !connectionPool.connected) {
//             connectionPool = await sql.connect(config);
//         }
//         return connectionPool;
//     } catch (err) {
//         console.error("Reconnecting to SQL Server...", err.message);
//         connectionPool = await sql.connect(config);
//         return connectionPool;
//     }
// }

// Without medicaid_id this queries WHERE 1=1, returning every member's
// appointments (PHI) to any authenticated caller. Non-admins must supply a
// medicaid_id they're the assigned care coordinator for.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
      }
    const body = JSON.parse(event.body || "{}");
    var medicaid_id = body.medicaid_id;
    var start_date = body.start_date;
    var end_date = body.end_date;

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { data: 'Unauthorized' }, event);
    }

    try {
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { data: 'Unauthorized' }, event);
        }

        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            if (!medicaid_id) {
                return buildResponse(400, { data: 'medicaid_id is required' }, event);
            }
            const assignmentLookup = await pool.request()
                .input('medicaid_id', sql.VarChar(50), medicaid_id)
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                return buildResponse(403, { data: 'Forbidden' }, event);
            }
        }

        const request = pool.request();

        // ✅ Base query
        let query = `
            SELECT ap.id,
                CONVERT(VARCHAR, action_date, 101) AS action_date,
                ap.action_time,
                ap.status,
                ap.place_of_appointment,
                ap.note,
                CONVERT(VARCHAR, ap.add_date, 101) AS add_date,
                ap.added_by,
                ap.medicaid_id,
                ap.provider_id,
                ap.vendor_id,
                u.FistName,
                u.LastName,
                t.type
            FROM MEM_SCHEDULE_APPOINTMENT_ACTION as ap
            LEFT JOIN MEM_USERS AS u 
                ON TRY_CAST(ap.added_by AS INT) = u.ID
            LEFT JOIN APPOINTMENT_TYPE AS t 
                ON TRY_CAST(ap.appiontment_type AS INT) = t.id
            WHERE 1=1
        `;

        // ✅ Safe filtering
        if (typeof medicaid_id !== 'undefined') {
            query += ` AND ap.medicaid_id = @medicaid_id`;
            request.input('medicaid_id', sql.VarChar(50), medicaid_id);
        }

        if (typeof start_date !== 'undefined' && typeof end_date !== 'undefined') {

            // Basic date validation
            if (isNaN(Date.parse(start_date)) || isNaN(Date.parse(end_date))) {
                // return {
                //     statusCode: 400,
                //     data: 'Invalid date format'
                // };
                return buildResponse(400,{ data: 'Invalid date format' },event);
            }

            query += ` AND ap.action_date BETWEEN @start_date AND @end_date`;
            request.input('start_date', sql.Date, start_date);
            request.input('end_date', sql.Date, end_date);
        }       
        const result = await request.query(query);       
        // return {
        //     statusCode: 200,
        //     data: result.recordset,
        // };
        return buildResponse(200,{ data: result.recordset },event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: err.message }),
        // };
        return buildResponse(500,{ error: 'Internal Server Error' },event);
    }
};