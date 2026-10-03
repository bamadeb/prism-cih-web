const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
exports.handler = async (event) => {
  let pool;

  try {
    // ✅ Input validation (important)
    if (event.httpMethod === 'OPTIONS') {
      return buildResponse(200, {}, event);
    }
    const body = JSON.parse(event.body || '{}');
    const plan = body?.plan;

    if (!plan || typeof plan !== 'string' || plan.trim() === '') {
      return buildResponse(400, { message: 'Invalid plan parameter' }, event);
    }

    // Finding 3.3.10: no auth check at all. This is reference/lookup data
    // (vendor list by plan, not member-specific), so only a baseline
    // "must be a real logged-in user" check is needed -- no ownership scope.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
    if (!callerLookup.recordset[0]) {
      return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    const request = pool.request();

    // ✅ Strong typing + trimming
    request.input('plan', sql.VarChar(50), plan.trim());

    const query = `
            SELECT DISTINCT 
                [VENDOR_NUM],
                [LAST_NAME],
                [ABBR]
            FROM dm.[VENDOR]
            WHERE [ROW_STATUS_CD] = @status
              AND PLANS = @plan
        `;

    // ✅ Avoid hardcoding values inside query
    request.input('status', sql.Char(1), '0');

    const result = await request.query(query);

    return buildResponse(
      200,
      { data: result.recordset, count: result.recordset.length },
      event
    );
  } catch (err) {
    console.error('Database error:', err);

    return buildResponse(500, { message: 'Internal Server Error' }, event);
  } finally {
    // ❌ Do NOT close pool in Lambda (reuse for performance)
    // if (pool) await pool.close();
  }
};
