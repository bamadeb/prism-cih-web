const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }
    const body = JSON.parse(event.body || "{}");
    let scheduled_type = body.scheduled_type;
    let role_id = body.role_id;

    let actionId = 0;
    if (role_id == 21) {
        actionId = scheduled_type;
    }

    // Finding: no check that the caller is even a known logged-in user.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    try {
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
        if (!callerLookup.recordset[0]) {
            return buildResponse(401, { message: "Unauthorized" }, event);
        }

        const result = await pool.request()
            .input('action_id', sql.Int, actionId)
            .query(`SELECT [id],[action_result]
            ,[action_id]
            ,[result_type]
            ,[Inactive]
            ,[result_order]
            ,[category_id]
            ,[type]
            ,[admin_order]
            ,[quick_action_add_flag]
            FROM ACTION_FOLLOWUP_RESULT
              WHERE action_id = @action_id
            ORDER BY result_order ASC`);

        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ error: "", message: "Internal server error" },event);
    }
};
