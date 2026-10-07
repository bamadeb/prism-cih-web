const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const { username } = body;

    if (!username) {
      return buildResponse(400, { error: "Username is required" }, event);
    }

    // Finding: no check that the caller is even a known logged-in user --
    // anyone could enumerate staff accounts by email.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { error: "Unauthorized" }, event);
    }

    const pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
    if (!callerLookup.recordset[0]) {
      return buildResponse(401, { error: "Unauthorized" }, event);
    }

    const request = pool.request();
    request.input('username', sql.VarChar, username);

    const query = `  SELECT ID,EmailID,FistName,LastName FROM MEM_USERS WHERE EmailID=@username`;
    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return buildResponse(200, { data: [] }, event);
    }

    const user = result.recordset[0];
    return buildResponse(200, { data: [user] }, event);
  } catch (err) {
    console.error('Database error:', err);
    return buildResponse(500, { error: "Internal Server Error" }, event);
  }
};
