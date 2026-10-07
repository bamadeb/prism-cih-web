const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

// This is the read-only counterpart of prismProcessMembersSeccionID.js
// (already Admin-only) -- it returns the same bulk CSV-staging PHI by
// session_id and had no auth check at all.
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
        .query(`SELECT mt.SUBSCRIBER_ID,mt.FIRST_NM,mt.MIDDLE_NM,mt.LAST_NM,mt.MEDICARE_ID,mt.MEDICAID_ID,mt.DT_OF_BIRTH,mt.SEX,mt.HOME_TELEPHONE,mt.PCP_TAX_ID,mt.ENROLL_DT,m.SUBSCRIBER_NUMBER AS exist_member
        FROM MEM_MEMBERS_TEMP AS mt LEFT JOIN MEM_MEMBERS AS m ON (mt.SUBSCRIBER_ID = m.SUBSCRIBER_NUMBER)
        WHERE mt.INSERT_SESSION_ID= @session_id`);

        return buildResponse(200,{data: result.recordset,
            totalRecords: result.recordset.length},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ message: "Internal server error" },event);
    }
};
