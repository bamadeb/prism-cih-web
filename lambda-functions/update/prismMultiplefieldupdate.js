
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

// let connectionPool;

// async function getDBConnection() {
//     if (!connectionPool) {
//         connectionPool = await sql.connect(config);
//     }
//     return connectionPool;
// }

// ✅ Allow only safe SQL identifiers (no spaces, no special chars)
function isValidIdentifier(name) {
    return /^[A-Za-z0-9_]+$/.test(name);
}

function isBlank(value) {
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// ✅ Table + id-column allow-list. isValidIdentifier() alone only proves
// table_name/id_field_name are *syntactically* safe identifiers -- it does
// NOT stop a caller from updating a table (or WHERE-clause column) this
// endpoint was never meant to touch. Derived from every real call to
// update() in the frontend (src/app) as of this review.
const ALLOWED_TABLES = {
    MEM_PLAN_MASTER: 'id',
    MEM_MEMBERS: 'RECIP_NO',
    MEM_ATTACHMENT: 'id',
    MEM_TASK_FOLLOW_UP: 'id',
    ROLE_PAGE_ACCESS: 'id'
};

// ✅ Required-field map, keyed by table -- only for tables with exactly ONE
// known update call site that always sends the same complete set of fields.
// MEM_ATTACHMENT is deliberately excluded: it has two different update call
// sites for the same table (updateStatusOnly sends only `status`;
// updateFileUrlToDB sends `attachment`/`title`/`status`), so a fixed
// required-set would reject one of its two legitimate partial-update shapes.
// Every table (MEM_ATTACHMENT included) still gets the general "no blank
// values" check below, applied to whatever fields ARE present.
const REQUIRED_FIELDS = {
    MEM_PLAN_MASTER: ['plan_name', 'start_date', 'end_date', 'status'],
    MEM_MEMBERS: ['NO_LONGER_PATIENT_FLAG', 'NO_LONGER_PATIENT_DATE', 'NO_LONGER_PATIENT_NOTE'],
    MEM_TASK_FOLLOW_UP: ['action_id', 'assign_to', 'action_date', 'status'],
    ROLE_PAGE_ACCESS: ['page_id', 'role_id', 'status']
};

// Columns each table may update -- the exact fields the app's dialogs send.
// Anything else (e.g. MEM_ATTACHMENT.attachment, MEM_TASK_FOLLOW_UP.medicaid_id)
// is rejected, so a caller can't rewrite arbitrary columns of an allowed table.
const ALLOWED_COLUMNS = {
    MEM_PLAN_MASTER: ['plan_name', 'start_date', 'end_date', 'status'],
    MEM_MEMBERS: ['NO_LONGER_PATIENT_FLAG', 'NO_LONGER_PATIENT_DATE', 'NO_LONGER_PATIENT_NOTE'],
    MEM_ATTACHMENT: ['title', 'status', 'note'],
    MEM_TASK_FOLLOW_UP: ['action_id', 'assign_to', 'action_date', 'action_note', 'status'],
    ROLE_PAGE_ACCESS: ['page_id', 'role_id', 'status']
};

// Optional free-text columns that may legitimately be cleared.
const BLANK_ALLOWED = new Set(['action_note', 'note']);

const ADMIN_ROLE_ID = 7;

async function hasPageAccess(pool, roleId, pageName) {
    const res = await pool.request()
        .input('role_id', sql.Int, roleId)
        .input('page_name', sql.VarChar, pageName)
        .query(`SELECT TOP 1 1 AS ok
                FROM ROLE_PAGE_ACCESS a
                JOIN MST_PAGES p ON a.page_id = p.id
                WHERE a.role_id = @role_id AND a.status = 0
                  AND UPPER(p.page_name) = UPPER(@page_name)`);
    return res.recordset.length > 0;
}

async function ownsMember(pool, callerId, medicaidId) {
    const res = await pool.request()
        .input('medicaid_id', sql.VarChar, String(medicaidId))
        .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
    return res.recordset.some(r => Number(r.Care_Coordinator_id) === Number(callerId));
}

// Per-table rule for a non-admin caller. Returns an HTTP status to reject
// with, or null when allowed.
async function authorizeRow(pool, caller, table, idValue) {
    switch (table) {
        case 'ROLE_PAGE_ACCESS':
            return 403;
        case 'MEM_PLAN_MASTER':
            return (await hasPageAccess(pool, caller.role_id, 'MANAGE PLANS')) ? null : 403;
        case 'MEM_ATTACHMENT': {
            // Same rule as prismdeleteAttachment.js: user-request files are Admin-only.
            const res = await pool.request().input('id', sql.Int, idValue)
                .query('SELECT type FROM MEM_ATTACHMENT WHERE id = @id');
            const row = res.recordset[0];
            if (!row) return 404;
            return row.type === 'user' ? 403 : null;
        }
        case 'MEM_MEMBERS':
            return (await ownsMember(pool, caller.ID, idValue)) ? null : 403;
        case 'MEM_TASK_FOLLOW_UP': {
            const res = await pool.request().input('id', sql.Int, idValue)
                .query('SELECT medicaid_id, assign_to FROM MEM_TASK_FOLLOW_UP WHERE id = @id');
            const task = res.recordset[0];
            if (!task) return 404;
            if (Number(task.assign_to) === Number(caller.ID)) return null;
            return (await ownsMember(pool, caller.ID, task.medicaid_id)) ? null : 403;
        }
        default:
            return 403;
    }
}

exports.handler = async (event) => {
    try {
        if (event.httpMethod === "OPTIONS") {
            return buildResponse(200,{},event);
        }
        const claims = event.requestContext?.authorizer?.claims || {};
        const callerSub = claims.sub;
        if (!callerSub) {
            return buildResponse(401, { message: 'Unauthorized' }, event);
        }

        let body;
        try {
            body = JSON.parse(event.body || "{}");
        } catch {
            return buildResponse(400, { message: 'Invalid JSON body' }, event);
        }
        const { id_field_name, id_field_value, table_name, updateData } = body;

        // ✅ Validate table name AND that id_field_name is the specific id
        // column allowed for that table -- not just any syntactically-valid
        // identifier.
        if (!Object.prototype.hasOwnProperty.call(ALLOWED_TABLES, table_name)
            || ALLOWED_TABLES[table_name] !== id_field_name) {
            return buildResponse(400,{message: 'Invalid table name'},event);
        }

        if (isBlank(id_field_value)) {
            return buildResponse(400,{message: 'id_field_value is required'},event);
        }

        if (!updateData || typeof updateData !== 'object' || Array.isArray(updateData)) {
            return buildResponse(400,{message: 'Invalid update data'},event);
        }

        // ✅ Whole-set required-field check for tables with one known shape.
        const requiredFields = REQUIRED_FIELDS[table_name];
        if (requiredFields) {
            const missing = requiredFields.filter(field => isBlank(updateData[field]));
            if (missing.length > 0) {
                return buildResponse(400, { message: `Missing required field(s): ${missing.join(', ')}` }, event);
            }
        }

        // ✅ General check for every table (including MEM_ATTACHMENT's
        // partial-update shapes): whatever fields ARE present must not be
        // blank -- catches e.g. an accidentally-empty status/title/attachment
        // string without assuming which fields a given call sends.
        const blankField = Object.keys(updateData)
            .find(key => !BLANK_ALLOWED.has(key) && isBlank(updateData[key]));
        if (blankField) {
            return buildResponse(400, { message: `Field cannot be blank: ${blankField}` }, event);
        }

        const allowedColumns = ALLOWED_COLUMNS[table_name];
        const badColumn = Object.keys(updateData).find(key => !allowedColumns.includes(key));
        if (badColumn) {
            return buildResponse(400, { message: `Column not allowed: ${badColumn}` }, event);
        }
        if (Object.keys(updateData).length === 0) {
            return buildResponse(400, { message: 'Invalid update data' }, event);
        }

        const pool = await getDBConnection();

        // Authorization: caller from the verified Cognito sub, then the
        // per-table rule (Admins may update any allowed row).
        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller) {
            return buildResponse(403, { message: 'Forbidden' }, event);
        }
        if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
            const denied = await authorizeRow(pool, caller, table_name, id_field_value);
            if (denied) {
                return buildResponse(denied, { message: denied === 404 ? 'Not found' : 'Forbidden' }, event);
            }
        }

        const request = pool.request();

        let setClauses = [];
        let index = 0;

        for (const [key, value] of Object.entries(updateData)) {

            if (!isValidIdentifier(key)) {
                //return { statusCode: 400, message: `Invalid column name: ${key}` };
                return buildResponse(400,{message: `Invalid column name: ${key}`},event);
            }
            // Value is bound below via request.input(), which parameterizes
            // it -- a content blacklist here (rejecting strings containing
            // words like "select"/"delete"/"insert") was intentionally not
            // added: it adds no real SQL-injection protection on top of
            // parameterization, but would reject legitimate free-text values.
            const paramName = `param${index}`;
            setClauses.push(`[${key}] = @${paramName}`);

            request.input(paramName, value);
            index++;
        }

        // ✅ Bind ID safely
        request.input('idValue', id_field_value);

        const updateSql = `
            UPDATE [${table_name}]
            SET ${setClauses.join(', ')}
            WHERE [${id_field_name}] = @idValue
        `;

        const result = await request.query(updateSql);

        
        return buildResponse(200,{message: 'Update successful', data: result.rowsAffected},event);
    } catch (err) {
        console.error("Error:", err);

        
        return buildResponse(500,{ message: "Internal server error" },event);
    }
};


