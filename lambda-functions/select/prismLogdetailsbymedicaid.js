
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser,
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433,
//     options: {
//         encrypt: true,
//         trustServerCertificate: true
//     }
// };

// let poolPromise;

// async function getDBConnection() {
//     if (!poolPromise) {
//         poolPromise = sql.connect(config);
//     }
//     return poolPromise;
// }

// This report exposes the system-wide authentication audit log (login/logout
// events for every user) -- SYSTEM LOG REPORT is Admin-only per the
// page-access data, so this endpoint requires Admin regardless of what
// medicaid_id/user_id filters are supplied. Confirmed in a security review
// that, without this check, any authenticated role could call it directly and
// get the full staff login history.
const ADMIN_ROLE_ID = 7;

const MAX_RANGE_DAYS = 366;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }

    // API Gateway has a Cognito User Pool authorizer ("CognitoProd") in front
    // of at least the sibling call-history route -- confirm it's attached
    // here too. Claims land in event.requestContext.authorizer.claims;
    // `sub` is the Cognito user's UUID, stored in MEM_USERS.cognito_username.
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    const body = JSON.parse(event.body || "{}");
    // Using isBlank-style checks rather than plain truthy checks -- a plain
    // `if (medicaid_id)` treats medicaid_id "0" as absent (0 is falsy),
    // silently widening the query to every member's logs. Not just a
    // theoretical gap: a security review used exactly medicaid_id=0 (with no
    // date range either) to pull back the complete cross-user audit log.
    let medicaid_id = (body.medicaid_id === undefined || body.medicaid_id === null || body.medicaid_id === '') ? null : body.medicaid_id;
    let user_id = body.user_id;

    // `user_id === null` was missing here -- a real JSON null (the default
    // "ALL USERS" state sent by system-log.ts's actionLogFormGroup) fell
    // through to parseInt(null, 10) = NaN. Since NaN !== null, the query
    // below still added `AND U.ID = @user_id` bound to NaN (the mssql driver
    // treats that as NULL), and `U.ID = NULL` never matches -- silently
    // zeroing out every row regardless of the date range. This is exactly
    // the {user_id: null, start_date, end_date} payload the frontend sends.
    if (user_id === 'null' || user_id === '' || user_id === null || typeof user_id === 'undefined') {
        user_id = null;
    } else {
        user_id = parseInt(user_id, 10);
        // Guard against any other malformed value (e.g. a non-numeric
        // string) producing NaN here too -- same silent-zero-rows failure
        // mode as the null case above.
        if (Number.isNaN(user_id)) {
            user_id = null;
        }
    }

    let start_date = body.start_date || null;
    let end_date = body.end_date || null;

    // The only real caller (system-log.ts) always sends both, as required
    // fields on its own form -- so this isn't tightening past what the
    // frontend already guarantees. This is also what closes the "no filters
    // at all" unfiltered full-table dump the medicaid_id=0 report used.
    if (!start_date || !end_date) {
        return buildResponse(400, { message: 'start_date and end_date are required' }, event);
    }

    const startMs = new Date(start_date).getTime();
    const endMs = new Date(end_date).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
        return buildResponse(400, { message: 'Invalid start_date/end_date' }, event);
    }
    if ((endMs - startMs) / (1000 * 60 * 60 * 24) > MAX_RANGE_DAYS) {
        return buildResponse(400, { message: `Date range cannot exceed ${MAX_RANGE_DAYS} days` }, event);
    }

    let pool;

    try {
        // ✅ Initialize pool FIRST
        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
            return buildResponse(403, { message: 'Forbidden' }, event);
        }

        const request = pool.request();

        let whereClauses = [
            "L.add_date >= @start_date AND L.add_date < DATEADD(DAY, 1, @end_date)"
        ];
        request.input("start_date", sql.DateTime, start_date);
        request.input("end_date", sql.DateTime, end_date);

        if (medicaid_id !== null) {
            whereClauses.push("L.medicaid_id = @medicaid_id");
            request.input("medicaid_id", sql.VarChar, medicaid_id);
        }

        if (user_id !== null) {
            whereClauses.push("U.ID = @user_id");
            request.input("user_id", sql.Int, user_id);
        }

        const whereSQL = "WHERE " + whereClauses.join(" AND ");

        // Only selecting what the frontend actually displays
        // (medicaid_id/log_name/log_details/log_status/add_date). The
        // previous version also returned L.log_by (internal user id),
        // L.action_type (which for LOGIN rows holds the raw username typed
        // at login -- effectively the user's email, per login.ts's
        // addloginHistory()), and a CONCAT'd staff name -- none of which the
        // UI uses, so there was no reason for this endpoint to expose them.
        const result = await request.query(`
            SELECT
                L.medicaid_id,
                L.log_name,
                L.log_details,
                L.log_status,
                L.[add_date]
            FROM MEM_SYSTEM_LOG L
            LEFT JOIN MEM_USERS U ON L.log_by = U.ID
            ${whereSQL}
            ORDER BY L.id DESC
        `);

        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database error:', err);
        return buildResponse(500,{ message: "Internal Server Error" },event);
    }
};
