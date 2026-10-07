const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

// Finding 3.1.10: triggers a bulk data-processing stored procedure for any
// session_id with no role check -- Admin-only, same as the sibling
// Process*SeccionID endpoints.
//
// Previously read event.session_id directly instead of JSON.parse(event.body)
// and returned plain {statusCode, body} objects with no CORS headers -- that
// matched a non-proxy API Gateway integration, but the route's integration
// (POST and OPTIONS) was switched to aws_proxy as part of fixing the CORS
// wildcard (Finding 3.4.2), which broke this handler (401/500, no headers).
// Converted to the same buildResponse + JSON-body pattern its siblings
// (prismProcessMembersSeccionID.js etc.) already use under aws_proxy.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }

    try {
        const claims = event.requestContext?.authorizer?.claims || {};
        const callerSub = claims.sub;
        if (!callerSub) {
            return buildResponse(401, { error: "Unauthorized" }, event);
        }

        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
            return buildResponse(403, { error: "Forbidden" }, event);
        }

        const body = JSON.parse(event.body || "{}");
        let session_id = body.session_id;
        if (session_id === undefined || session_id === null || session_id === '' || session_id === 'null') {
            session_id = null;
        } else if (isNaN(session_id)) {
            return buildResponse(400, { error: "Invalid session_id" }, event);
        }

        const result = await pool
            .request()
            .input("session_id", sql.Int, parseInt(session_id, 10))
            .execute("sp_ProcessPCRdata");

        // result.recordsets → array of 5 result sets
        const response = {
            loglist: result.recordsets[0] || []
        };

        return buildResponse(200, response, event);
    } catch (error) {
        console.error("Error in Lambda:", error);
        return buildResponse(500, { error: "Internal Server Error" }, event);
    }
};
