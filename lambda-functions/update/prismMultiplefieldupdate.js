
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

exports.handler = async (event) => {
    try {
        if (event.httpMethod === "OPTIONS") {
            return buildResponse(200,{},event);
        }
        const body = JSON.parse(event.body || "{}");
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
        const blankField = Object.keys(updateData).find(key => isBlank(updateData[key]));
        if (blankField) {
            return buildResponse(400, { message: `Field cannot be blank: ${blankField}` }, event);
        }

        const pool = await getDBConnection();
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


