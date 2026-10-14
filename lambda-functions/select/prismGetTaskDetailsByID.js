const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    const body = JSON.parse(event.body || "{}");
    let task_id = body.task_id;

    // Finding: full task record for ANY task_id regardless of assignee.
    // Admin bypasses; non-admins must either be the task's own assignee or
    // the assigned care coordinator for the task's member -- same per-table
    // rule already used for MEM_TASK_FOLLOW_UP in prismMultiplefieldupdate.js.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { error: "", message: "Unauthorized" }, event);
    }

    try {
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { error: "", message: "Unauthorized" }, event);
        }

        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            const taskLookup = await pool.request()
                .input('task_id', sql.Int, task_id)
                .query('SELECT medicaid_id, assign_to FROM MEM_TASK_FOLLOW_UP WHERE id = @task_id');
            const task = taskLookup.recordset[0];
            if (!task) {
                return buildResponse(404, { error: "", message: "Not found" }, event);
            }
            if (Number(task.assign_to) !== Number(caller.ID)) {
                const assignmentLookup = await pool.request()
                    .input('medicaid_id', sql.VarChar, String(task.medicaid_id))
                    .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
                const member = assignmentLookup.recordset[0];
                if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                    return buildResponse(403, { error: "", message: "Forbidden" }, event);
                }
            }
        }

        const result = await pool.request()
            .input('task_id', sql.Int, task_id)
            .query(`SELECT id
            ,medicaid_id
            ,vendor_id
            ,action_id
            ,action_date
            ,assign_to
            ,action_note
            ,attachment
            ,status
            ,add_by
            ,add_date
            ,modified_date
            ,task_type
            ,completed_date
            FROM MEM_TASK_FOLLOW_UP WHERE id= @task_id`);

        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ error: "", message: "Internal Server Error" },event);
    }
};