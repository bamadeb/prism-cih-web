const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }
    const body = JSON.parse(event.body || "{}");
    let { department_id } = body;

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

        const request = pool.request();

        let query = `
            SELECT
                [ID],
                [department_id],
                [FistName],
                [LastName],
                [EmailID]
            FROM MEM_USERS
        `;

        if (department_id !== undefined && department_id !== null) {
            if (isNaN(department_id)) {
                return buildResponse(400,{data: 'Invalid department_id'},event);
            }

            query += ` WHERE department_id = @department_id`;
            request.input('department_id', sql.Int, department_id);
        }

        const result = await request.query(query);
        return buildResponse(200,{data: result.recordset},event);

    } catch (err) {
        console.error('Database error:', err);
        return buildResponse(500,{ message: "Internal server error" },event);
    }
};
