const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

// Read-only counterpart of prismProcessQualityGapsSeccionID.js (already
// Admin-only). Had an OPTIONS guard and a parameterized query already,
// just no auth check.
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
                qt.Subscriber_ID, qt.Measure_Name, qt.Submeasure, qt.First_Name, qt.Middle_Name, qt.Last_Name,
                qt.Medicare_ID, qt.Medicaid_ID, qt.Date_of_Birth, qt.Sex, qt.Provider_ID, qt.Provider_TIN,
                qt.Provider_Name, qt.Numerator_Gap, q.SUBSCRIBER_ID AS quality_gaps_exist, m.SUBSCRIBER_NUMBER AS member_exist
            FROM MEM_CIH_QUALITY_TEMP qt
            LEFT JOIN ( SELECT DISTINCT SUBSCRIBER_ID, SUB_MEASURE, NUMERATOR_GAP FROM MEM_CIH_QUALITY ) q
            ON qt.Subscriber_ID = q.SUBSCRIBER_ID AND qt.Submeasure = q.SUB_MEASURE AND qt.Numerator_Gap = q.NUMERATOR_GAP
            LEFT JOIN MEM_MEMBERS AS m ON(qt.Subscriber_ID = m.SUBSCRIBER_NUMBER)
            WHERE qt.INSERT_SESSION_ID = @session_id`);
        return buildResponse(200,{data: result.recordset, totalRecords: result.recordset.length},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ message: "Internal server error" },event);
    }
};
