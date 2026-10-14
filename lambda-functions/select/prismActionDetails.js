
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    const body = JSON.parse(event.body || "{}");
    const action_id = body.action_id;

    // Finding: full engagement/contact record (incl. medicaid_id, notes,
    // attachment) for ANY action_id with no ownership check. Admin bypasses;
    // non-admins must be the assigned care coordinator for that action's
    // member (looked up via its medicaid_id), same pattern as the rest of
    // this member-detail cluster.
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
            const actionLookup = await pool.request()
                .input('action_id', sql.VarChar, action_id)
                .query('SELECT medicaid_id FROM MEM_MEMBER_ACTION_FOLLOW_UP WHERE id = @action_id');
            const actionRow = actionLookup.recordset[0];
            if (!actionRow) {
                return buildResponse(404, { error: 'Not found' }, event);
            }
            const assignmentLookup = await pool.request()
                .input('medicaid_id', sql.VarChar, String(actionRow.medicaid_id))
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                return buildResponse(403, { error: 'Forbidden' }, event);
            }
        }

        const result = await pool.request()
            .input('action_id', sql.VarChar, action_id)
            .query(`SELECT [id]
                    ,[medicaid_id]
                    ,[action_type_source]
                    ,[action_id]
                    ,[panel_id]
                    ,[engagement_type]
                    ,[action_date]
                    ,[action_time]
                    ,[action_status]
                    ,[add_date]
                    ,[add_by]
                    ,[interpreter_name]
                    ,[Parent_id]
                    ,[action_note]
                    ,[action_result_id]
                    ,[action_change_date]
                    ,[last_modified_date]
                    ,[number_of_attempt]
                    ,[Recertification_Process]
                    ,[attachment]
                    ,[measure]
                    ,[externall]
                    ,[contact]
                    ,[status]
                    ,[purpose]
                    ,[service_type]
                    ,[current_session]
                    ,[visit_alert_id]
                FROM MEM_MEMBER_ACTION_FOLLOW_UP WHERE id =@action_id`);

        return buildResponse(200, { data: result.recordset }, event);

    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500, { error: "Internal server error" }, event);
    } finally {
        //if (pool) await pool.close();
    }
};
