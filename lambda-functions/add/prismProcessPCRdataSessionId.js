const { getDBConnection, sql } = require('/opt/dbConfig');
// const sql = require('mssql');
// var conn = require('/opt/config.json');

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

// Finding 3.1.10: triggers a bulk data-processing stored procedure for any
// session_id with no role check -- Admin-only, same as the sibling
// Process*SeccionID endpoints.
//
// NOTE: unlike its siblings this handler reads event.session_id directly
// instead of JSON.parse(event.body), and returns plain {statusCode, body}
// objects instead of using /opt/responseHelper's buildResponse (no CORS
// headers set on its responses) -- this suggests it's wired to a different,
// non-proxy API Gateway integration. Left as-is here since changing it could
// break that integration without confirming the actual Gateway config; if
// event.requestContext.authorizer.claims turns out to be unpopulated under
// this integration type, the auth check below will always 401 and that
// needs infra investigation, not another code change.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    try {
        const claims = event.requestContext?.authorizer?.claims || {};
        const callerSub = claims.sub;
        if (!callerSub) {
            return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
        }

        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
            return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
        }

        let session_id = event.session_id;
        // Convert to integer if not null/undefined/empty
        if (session_id === undefined || session_id === null || session_id === '' || session_id === 'null') {
            session_id = null;
        } else {
            if (isNaN(session_id)) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: "Invalid session_id" }),
                };
            }
        }

        const result = await pool
            .request()
            .input("session_id", sql.Int, parseInt(session_id, 10))
            .execute("sp_ProcessPCRdata");

        // result.recordsets → array of 5 result sets
        const response = {
            loglist: result.recordsets[0] || []
        };

        return {
            statusCode: 200,
            data: response,
        };
    } catch (error) {
        console.error("Error in Lambda:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal Server Error" }),
        };
    }
};
