const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }
    const body = JSON.parse(event.body || "{}");
    const medicaid_id = body.medicaid_id;
    const PROCESS_STATUS = body.PROCESS_STATUS;

    // Finding (IDOR): no requirement that medicaid_id be present, and no
    // check that a non-admin caller is that member's assigned care
    // coordinator -- any authenticated caller could pull any member's
    // quality gaps.
    if (!medicaid_id) {
        return buildResponse(400, { error: 'medicaid_id is required' }, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { error: 'Unauthorized' }, event);
    }

    try {
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { error: 'Unauthorized' }, event);
        }

        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            const assignmentLookup = await pool.request()
                .input('medicaid_id', sql.VarChar, medicaid_id)
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                return buildResponse(403, { error: 'Forbidden' }, event);
            }
        }

        const request = pool.request();
        request.input('medicaid_id', sql.VarChar(20), medicaid_id);

        let filter_sql = "";
        if (PROCESS_STATUS) {
            filter_sql = " AND quality.PROCESS_STATUS = @PROCESS_STATUS";
            request.input('PROCESS_STATUS', sql.VarChar(50), PROCESS_STATUS);
        }

        const query = `
            SELECT B.*
            FROM (
                SELECT quality.SUBSCRIBER_ID, quality.SUB_MEASURE, MIN(ID) AS ID
                FROM MEM_MEMBERS AS m
                JOIN MEM_CIH_QUALITY AS quality
                    ON m.SUBSCRIBER_NUMBER = quality.SUBSCRIBER_ID
                WHERE m.RECIP_NO = @medicaid_id
                ${filter_sql}
                GROUP BY quality.SUBSCRIBER_ID, quality.SUB_MEASURE
            ) AS A
            LEFT JOIN MEM_CIH_QUALITY AS B ON A.ID = B.ID
        `;

        const result = await request.query(query);
        return buildResponse(200, { data: result.recordset }, event);
    } catch (err) {
        console.error('❌ Query execution error:', err);
        return buildResponse(500, { error: "Internal Server Error" }, event);
    }
};
