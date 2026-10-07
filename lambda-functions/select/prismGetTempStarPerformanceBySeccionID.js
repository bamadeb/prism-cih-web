const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

// Full rewrite. Original bugs:
//  - `session_id` was referenced in the query but never read from the
//    request anywhere (both lines that would have defined it were
//    commented out) -> every single call threw a ReferenceError.
//  - No `buildResponse`/CORS at all, and no OPTIONS guard.
//  - WHERE clause was built via raw string concatenation of session_id
//    (SQL injection) -- fixed to a parameterized query below.
//  - No auth check. Gated Admin-only to match the other session/file
//    staging siblings in this API (e.g. prismProcessPCRdataSessionId.js).
exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }
    const body = JSON.parse(event.body || "{}");
    const session_id = body.session_id;

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
            return buildResponse(403, { message: "Forbidden" }, event);
        }

        const result = await pool.request()
            .input('session_id', sql.VarChar, session_id)
            .query(`SELECT
               t.ID ,t.Measure_Name ,t.Measure_Code ,t.[Statistics]
              ,CONVERT(VARCHAR,t.Measure_Date, 101) AS Measure_Date
              ,t.Measure_Value ,t.INSERT_SESSION_ID
              ,CONVERT(VARCHAR,t.ADDED_ON, 101) AS ADDED_ON
              ,t.PROCESS_STATUS ,t.ADDED_BY,
                CASE WHEN o.Measure_Code IS NOT NULL THEN 1 ELSE 0 END AS duplicate_flag
            FROM MEM_STAR_PERFORMANCE_REPORT_DATA_TEMP t
            LEFT JOIN MEM_STAR_PERFORMANCE_REPORT_DATA o
                ON o.Measure_Code = t.Measure_Code AND o.[Statistics] = t.[Statistics] AND o.Measure_Date = t.Measure_Date
            WHERE t.INSERT_SESSION_ID = @session_id`);

        return buildResponse(200, { data: result.recordset, totalRecords: result.recordset.length }, event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500, { message: "Internal server error" }, event);
    }
};
