const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

// Ops/file-processing audit metadata -- same category as
// prismFileProcesslistByType.js. Had no auth check at all.
exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
      }
      const body = JSON.parse(event.body || "{}");
    const session_id = body.session_id;

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    try {
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
            return buildResponse(403, { message: "Forbidden" }, event);
        }

        const result = await pool.request()
        .input('session_id', sql.VarChar(50), session_id)
        .query(`SELECT pl.SESSION_ID, pl.LOG_TYPE, pl.LOG_FOR, pl.MESSAGE, pl.RECORD_COUNT, pl.LOG_DATE
            FROM MEM_PROCESS_LOG AS pl
            WHERE pl.SESSION_ID = @session_id
            ORDER BY pl.LOG_DATE ASC;`);
        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ message: "Internal server error" },event);
    }
};
