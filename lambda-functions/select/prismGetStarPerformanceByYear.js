const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }
    const body = JSON.parse(event.body || "{}");
    const year = body.year;
    const currentYear = body.currentYear;

    // Finding: no check that the caller is even a known logged-in user.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { error: "Unauthorized" }, event);
    }

    try {
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
        if (!callerLookup.recordset[0]) {
            return buildResponse(401, { error: "Unauthorized" }, event);
        }

        const result = await pool.request()
            .input('YEAR1', sql.Int, year)
            .input('YEAR2', sql.Int, currentYear)
            .input('OTHERYEAR', sql.Int, currentYear)
            .execute("sp_GetStarReportByDateNew");

        return buildResponse(200,{ data: result.recordset },event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ error: "Internal Server Error"},event);
    }
};
