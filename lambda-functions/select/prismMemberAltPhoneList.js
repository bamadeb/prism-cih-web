

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
//         encrypt: true, // Required for Azure SQL; set to false for on-premises
//         trustServerCertificate: true // Set true if using self-signed certificates
//     }
// };

// let poolPromise;
// async function getDBConnection() {
//     if (!poolPromise) {
//         poolPromise = sql.connect(config);
//     }
//     return poolPromise;
// }

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    //var medicaid_id = event.medicaid_id;
    const body = JSON.parse(event.body || "{}");
    const medicaid_id = body.medicaid_id;
    //medicaid_id = '0010143576';

    // Finding: member PHI (phone numbers) for ANY medicaid_id with no
    // ownership check. Admin bypasses, same pattern as prismMemberhistory.js.
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

        const result = await pool.request().input('medicaid_id', sql.VarChar(20), medicaid_id).query(`
            SELECT A.* FROM(
                    SELECT   '' AS id,
                        RECIP_NO AS medicaid_id,
                        OTHER_PHONE  AS alt_phone_no,
                        '' AS add_date,
                        '' AS add_by,
                        '(ROSTER)' AS FistName,
                        '' AS LastName,
                        '' AS initial
                    FROM  MEM_MEMBERS
                    WHERE RECIP_NO = @medicaid_id  
                    UNION ALL
                    SELECT AP.[id]
                        ,AP.[medicaid_id]
                        ,AP.[alt_phone_no]
                        ,CONVERT(VARCHAR, AP.[add_date], 101) AS add_date
                        ,AP.[add_by]
                        ,US.FistName, US.LastName, US.initial
                    FROM MEM_ALT_PHONE AS AP 
                    JOIN MEM_USERS AS US ON (AP.add_by = US.ID) 
                    WHERE AP.medicaid_id = @medicaid_id) AS A 
                    ORDER BY id ASC `);
        
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

        return buildResponse(500,{ error: "Internal server error" },event);
    }
};
