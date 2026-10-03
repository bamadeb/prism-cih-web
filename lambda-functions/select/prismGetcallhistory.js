const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// var conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser, 
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433, 
//     options: {
//         encrypt: true, // Required for Azure SQL; set to false for on-premises
//         trustServerCertificate: true // Set true if using self-signed certificates
//     }
// };

// let connectionPool;

// async function getDBConnection() {
//     try {
//       if (!connectionPool || !connectionPool.connected) {
//         connectionPool = await sql.connect(config);
//       }
//       return connectionPool;
//     } catch (err) {
//       console.error("Reconnecting to SQL Server...", err.message);
//       connectionPool = await sql.connect(config); // force reconnect
//       return connectionPool;
//     }
// }

// Admin bypasses the per-member assignment check below. If Management/Social
// Worker/Benefits Specialist should also be able to see any member (rather
// than only their own assigned members), add their role_id values here --
// not confirmed one way or the other yet, so only Admin is trusted for now.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    const body = JSON.parse(event.body || "{}");
    var medicaid_id = body.medicaid_id;

    if (!medicaid_id) {
        return buildResponse(400, { error: 'medicaid_id is required' }, event);
    }

    // API Gateway has a Cognito User Pool authorizer ("CognitoProd") in front
    // of this route, so the caller's verified ID token claims arrive here in
    // event.requestContext.authorizer.claims -- `sub` is the Cognito user's
    // UUID, stored in MEM_USERS.cognito_username.
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

        // IDOR fix (confirmed exploitable in a security review: any
        // authenticated role could read any member's call history by
        // supplying an arbitrary medicaid_id). Non-admins must be the
        // member's assigned care coordinator.
        //
        // CORRECTED: Care_Coordinator_id lives on MEM_OUTREACH_MEMBERS, keyed
        // directly by medicaid_id -- confirmed from prismGetUserMemberList.js
        // (`FROM MEM_OUTREACH_MEMBERS MT ... WHERE (@user_id = 0 OR
        // MT.Care_Coordinator_id = @user_id)`) and prismMemberAllDetails.js
        // (`MMT.Care_Coordinator_id` selected from `MEM_OUTREACH_MEMBERS MMT`).
        // The original version of this fix queried MEM_MEMBERS.RECIP_NO for
        // this column instead, which likely doesn't exist there -- that would
        // have thrown a SQL error on every non-admin call, turning this into
        // an availability bug (500s) rather than just a security fix.
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
        request.input('medicaid_id', sql.VarChar, medicaid_id);
        const result = await request.query(`SELECT act.[id]
        ,act.[medicaid_id]
        ,act.[action_type_source]
        ,act.[action_id]
        ,act.[panel_id]
        ,act.[engagement_type] 
        ,CONVERT(VARCHAR, act.[action_date], 101) AS action_date
        ,act.[action_time]
        ,act.[action_status]
        ,act.[add_date]
        ,act.[add_by]
        ,act.[interpreter_name]
        ,act.[Parent_id]
        ,act.[action_note]
        ,act.[action_result_id]
        ,act.[action_change_date]
        ,act.[last_modified_date]
        ,act.[number_of_attempt]
        ,act.[Recertification_Process]
        ,act.[attachment]
        ,act.[measure]
        ,act.[externall]
        ,act.[contact]
        ,act.[status]
        ,act.[purpose]
        ,act.[service_type]
        ,act.[current_session]
        ,act.[visit_alert_id]
        ,actr.action_result
        ,mpa.action_type
    FROM MEM_MEMBER_ACTION_FOLLOW_UP AS act 
    LEFT JOIN ACTION_FOLLOWUP_RESULT AS actr ON(act.action_result_id=actr.id) 
    LEFT JOIN MEM_MEMBER_PANEL_ACTION AS mpa ON(act.panel_id=mpa.id)
    WHERE [medicaid_id]= @medicaid_id ORDER BY act.action_date DESC`);
        
        // return {
        //     statusCode: 200,
        //     data: result.recordset,
        // };
        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: err.message }),
        // };
        return buildResponse(500,{  error: "Internal server error" },event);
    }  
};
