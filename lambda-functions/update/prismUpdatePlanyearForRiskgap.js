const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

exports.handler = async (event) => {

    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return buildResponse(200, {}, event);
    }

    let body = {};

    try {
        // Parse request body safely
        body = JSON.parse(event.body || '{}');
    } catch (err) {
        console.error('Invalid JSON:', err);

        return buildResponse(400, {
            message: 'Invalid JSON request body'
        }, event);
    }

    const medicaid_id = body.medicaid_id;
    const PLANYEAR = body.PLANYEAR;
    const PLAN_YEAR = body.PLAN_YEAR;
    const DIAG_CODE = body.DIAG_CODE;

    // Not logging medicaid_id -- this app handles PHI (member/medicaid
    // identifiers), which shouldn't be written to plaintext CloudWatch logs.
    console.log('Request parameters:', { PLANYEAR, PLAN_YEAR, DIAG_CODE });

    // Validate required parameters
    if (!medicaid_id || !PLANYEAR || !PLAN_YEAR || !DIAG_CODE) {
        return buildResponse(400, {
            message: 'Missing required parameters',
            required: [
                'medicaid_id',
                'PLANYEAR',
                'PLAN_YEAR',
                'DIAG_CODE'
            ]
        }, event);
    }

    // Both must be real, in-range years -- reject arbitrary strings.
    const planYearNum = Number(PLANYEAR);
    const prevYearNum = Number(PLAN_YEAR);
    const currentYear = new Date().getFullYear();
    const isValidYear = (y) => Number.isInteger(y) && y >= 2000 && y <= currentYear + 1;

    if (!isValidYear(planYearNum) || !isValidYear(prevYearNum)) {
        return buildResponse(400, { message: 'Invalid PLANYEAR or PLAN_YEAR' }, event);
    }

    // Finding 3.4.6: medicaid_id came straight from the client with no check
    // that the caller is that member's assigned care coordinator. Admin
    // bypasses, matching the pattern used for the rest of this gap-status
    // cluster (Finding 3.4.7). Route confirmed to have Cognito_Dev attached.
    const ADMIN_ROLE_ID = 7;
    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    let pool;

    try {

        // Get database connection
        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(401, { message: 'Unauthorized' }, event);
        }

        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            const assignmentLookup = await pool.request()
                .input('medicaid_id', sql.VarChar, String(medicaid_id))
                .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
            const member = assignmentLookup.recordset[0];
            if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
                return buildResponse(403, { message: 'Forbidden' }, event);
            }
        }

        // Execute UPDATE
        const result = await pool
            .request()
            .input('medicaid_id', sql.VarChar, String(medicaid_id))
            .input('PLANYEAR', sql.VarChar, String(PLANYEAR))
            .input('PLAN_YEAR', sql.VarChar, String(PLAN_YEAR))
            .input('DIAG_CODE', sql.VarChar, String(DIAG_CODE))
            .query(`
                UPDATE gap
                SET gap.PLAN_YEAR = @PLANYEAR
                FROM MEM_RISK_GAP AS gap
                LEFT JOIN MEM_MEMBERS AS m
                    ON m.SUBSCRIBER_NUMBER = gap.SUBSCRIBER_NUMBER
                WHERE m.RECIP_NO = @medicaid_id
                  AND gap.PLAN_YEAR = @PLAN_YEAR
                  AND gap.DIAG_CODE = @DIAG_CODE
            `);

        console.log('Rows affected:', result.rowsAffected);

        return buildResponse(200, {
            message: 'PLAN_YEAR updated successfully',
            rowsAffected: result.rowsAffected
        }, event);

    } catch (err) {

        console.error('Database/SQL Error:', err);

        return buildResponse(500, {
            message: 'Internal Server Error'
        }, event);
    }
};