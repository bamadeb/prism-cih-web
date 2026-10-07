const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

// Read-only counterpart of prismProcessRiskGapsSeccionID.js (already
// Admin-only). Original had no OPTIONS guard, no auth check, and built
// the WHERE clause via raw string concatenation of session_id (SQL
// injection) -- fixed to a parameterized query below.
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
            .query(`SELECT  rgt.PAT_ID, rgt.MBR_ID,rgt.PRODUCT_TYPE, rgt.HCC_CATEGORY , rgt.HCC_MODEL ,rgt.STATUS,rgt.RELEVANT_DATE ,rgt.DIAG_SOURCE ,rgt.DIAG_CODE ,rgt.DIAG_DESC
            ,rgt.PROV_SPECIALTY, rg.SUBSCRIBER_NUMBER AS exist_gap, m.SUBSCRIBER_NUMBER AS member_exist
            FROM MEM_RISK_GAP_TEMP AS rgt
            LEFT JOIN (
                        SELECT DISTINCT SUBSCRIBER_NUMBER, RELEVANT_DATE, DIAG_CODE
                        FROM MEM_RISK_GAP
                    ) rg
                    ON rgt.MBR_ID = rg.SUBSCRIBER_NUMBER AND rgt.RELEVANT_DATE = rg.RELEVANT_DATE AND rgt.DIAG_CODE = rg.DIAG_CODE
            LEFT JOIN MEM_MEMBERS AS m ON(rgt.MBR_ID = m.SUBSCRIBER_NUMBER)
            WHERE rgt.INSERT_SESSION_ID = @session_id`);

        return buildResponse(200,{ data: result.recordset,totalRecords: result.recordset.length },event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ error: "Internal Server Error" },event);
    }
};
