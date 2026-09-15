const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//   user: conn.dbuser,
//   password: conn.dbpassword,
//   server: conn.dbhost,
//   database: conn.dbname,
//   port: 1433,
//   options: {
//     encrypt: true,
//     trustServerCertificate: true
//   },
//   pool: {
//     max: 10,
//     min: 0,
//     idleTimeoutMillis: 30000
//   }
// };

// let poolPromise;

// async function getDBConnection() {
//   if (!poolPromise) {
//     poolPromise = sql.connect(config);
//   }
//   return poolPromise;
// }

// ✅ Validate identifier (table/column)
function isValidName(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

// ✅ Table allow-list. This endpoint is generic (client supplies table_name +
// insertDataArray), so isValidName() alone only proves the name is *syntactically*
// safe as an identifier -- it does NOT stop a caller from writing to a table this
// endpoint was never meant to touch (e.g. MEM_USERS). This list was derived from
// every `table_name:` literal actually sent to insert()/multipleRowInsert() in the
// frontend (src/app) as of this review -- if a new legitimate table is added on the
// frontend, it must be added here too, or inserts to it will start failing.
const ALLOWED_TABLES = new Set([
  'MEM_SCHEDULE_APPOINTMENT_ACTION',
  'MEM_MEMBER_PCP_VISIT',
  'MEM_MEMBER_ACTION_FOLLOW_UP',
  'MEM_TASK_FOLLOW_UP',
  'MEM_GAP_OBSERVATION_DATA',
  'MEM_STAR_PERFORMANCE_PRISM_DATA',
  'MEM_SYSTEM_LOG',
  'MEM_ALT_ADDRESS',
  'MEM_ALT_PHONE',
  'USER_CREATION_REQUEST',
  'MEM_ATTACHMENT',
  'MEM_PLAN_MEMBERS',
  'MEM_PLAN_MASTER',
  'MEM_REFERRING',
  'ROLE_PAGE_ACCESS',
  // Bulk CSV-import staging tables (process-file/*.ts) -- rows come from
  // parsed spreadsheet columns rather than a fixed form, so they're
  // allow-listed here but deliberately excluded from REQUIRED_FIELDS below.
  'MEM_STAR_PERFORMANCE_REPORT_DATA_TEMP',
  'MEM_MEMBERS_TEMP',
  'MEM_RISK_GAP_TEMP',
  'MEM_CIH_PCR_TEMP',
  'MEM_CIH_QUALITY_TEMP'
  // NOTE: MEM_MEMBERS and MEM_USERS were removed from this list -- neither is
  // actually inserted through this endpoint. MEM_MEMBERS is only ever
  // updated (via prismMultiplefieldupdate, see confirm-dialog.ts), and
  // MEM_USERS is created through the dedicated prismCreateUser Lambda. Listing
  // them here would have granted this generic endpoint write access to two
  // sensitive tables it's never actually used for.
  // NOTE: MEM_OUTREACH_MEMBERS was removed too -- it's only ever updated
  // (via prismMultipleRowAndFieldUpdate, see transfer-dialog.ts), never
  // inserted through this endpoint.
]);

// ✅ Required-field map, keyed by table. isValidName()/ALLOWED_TABLES above
// only check that columns are safe identifiers and that the table is one
// this endpoint may write to -- neither stops a caller from omitting fields
// the real feature requires, silently inserting incomplete rows. Each list
// here was derived from that table's actual frontend form (Validators.required
// fields) plus whatever the payload-building code always populates itself
// (e.g. medicaid_id, added_by).
//
// Deliberately NOT covered here:
//   - The five *_TEMP tables above (bulk CSV import; rows come from parsed
//     spreadsheet columns, not a fixed form -- a fixed required-list doesn't
//     fit that shape and risks rejecting legitimate partial import rows).
//   - MEM_GAP_OBSERVATION_DATA: already goes through much more detailed,
//     per-Type (risk vs quality) required-field validation in the frontend
//     (add-action.ts, updateQualityAndRiskData) with several fields required
//     via an OR condition (at least one of CPTPx/HCPCSPx/ICDDX10) that a
//     simple required-list can't express -- duplicating that here risks
//     subtly disagreeing with it. Left unvalidated at this layer for now.
const REQUIRED_FIELDS = {
  MEM_SCHEDULE_APPOINTMENT_ACTION: ['medicaid_id', 'action_date', 'action_time', 'status', 'appiontment_type', 'vendor_id', 'provider_id', 'place_of_appointment', 'added_by'],
  MEM_MEMBER_PCP_VISIT: ['MEDICAID_ID', 'VISIT_DATE', 'VISIT_TYPE', 'ADDED_BY'],
  MEM_MEMBER_ACTION_FOLLOW_UP: ['medicaid_id', 'action_date'],
  MEM_TASK_FOLLOW_UP: ['medicaid_id', 'action_id', 'assign_to', 'action_date', 'status', 'add_by'],
  MEM_STAR_PERFORMANCE_PRISM_DATA: ['MEDICAID_ID', 'MEASURE', 'MEASURE_DATE', 'MEASURE_YEAR', 'NUM_COUNT', 'PCP_TAX_ID', 'ADDED_BY'],
  MEM_SYSTEM_LOG: ['log_name', 'log_details', 'log_status', 'log_by', 'action_type'],
  MEM_ALT_ADDRESS: ['medicaid_id', 'alt_address', 'alt_city', 'alt_state', 'alt_zip', 'add_by'],
  MEM_ALT_PHONE: ['medicaid_id', 'alt_phone_no', 'add_by'],
  USER_CREATION_REQUEST: ['FIRST_NAME', 'LAST_NAME', 'EMAIL', 'PHONE', 'ROLE_ID', 'STATUS', 'DATE_OF_REQUEST', 'ADDED_BY'],
  MEM_ATTACHMENT: ['type', 'type_id', 'attachment', 'added_by', 'status'],
  MEM_PLAN_MEMBERS: ['medicaid_id', 'plan_id', 'added_by'],
  MEM_PLAN_MASTER: ['plan_name', 'start_date', 'end_date', 'status'],
  MEM_REFERRING: ['medicaid_id', 'department_id', 'refer_to', 'refer_by']
};

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// ✅ Chunk helper
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200,{},event);
  }
  const body = JSON.parse(event.body || "{}");
  const { table_name, insertDataArray } = body;
  const primaryKeyField = "ID";

  if (!Array.isArray(insertDataArray) || insertDataArray.length === 0) {
    // return {
    //   statusCode: 400,
    //   message: "insertDataArray must be a non-empty array."
    // };
    return buildResponse(400,{ message: "insertDataArray must be a non-empty array." },event);
  }

  // ✅ Validate table name against the allow-list (isValidName alone only
  // proves it's a syntactically safe identifier, not that it's a table this
  // endpoint is allowed to write to).
  if (!isValidName(table_name) || !ALLOWED_TABLES.has(table_name)) {
    return buildResponse(400,{ message: "Invalid table name." },event);
  }

  // ✅ Required-field check -- mirrors that table's frontend form validators
  // (see REQUIRED_FIELDS above for what's covered and what's deliberately
  // not). Checks every row, not just insertDataArray[0], since a batch could
  // mix a valid row with an incomplete one.
  const requiredFields = REQUIRED_FIELDS[table_name];
  if (requiredFields) {
    for (const row of insertDataArray) {
      const missing = requiredFields.filter(field => isBlank(row[field]));
      if (missing.length > 0) {
        return buildResponse(400, { message: `Missing required field(s): ${missing.join(', ')}` }, event);
      }
    }
  }

  try {
    const pool = await getDBConnection();

    // ✅ Validate columns
    const columns = Object.keys(insertDataArray[0]).filter(col => isValidName(col));
    if (columns.length === 0) {
      //return { statusCode: 400, message: "No valid columns provided" };
      return buildResponse(400,{ message: "No valid columns provided" },event);
    }

    const MAX_SQL_PARAMS = 1900;
    const MAX_BATCH_ROWS = Math.max(1, Math.floor(MAX_SQL_PARAMS / columns.length));
    const batches = chunkArray(insertDataArray, MAX_BATCH_ROWS);

    let allInsertedIds = [];

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const request = pool.request();

      const fields = columns.map(col => `[${col}]`).join(', ');
      const valuesClauses = [];

      let paramCount = 0;

      batch.forEach((row, rowIndex) => {
        const placeholders = [];

        columns.forEach((col, colIndex) => {
          const paramName = `p_${b}_${rowIndex}_${colIndex}`;

          // Values are bound below via request.input(), which parameterizes
          // them -- a content blacklist here (rejecting strings containing
          // words like "select"/"delete"/"insert") was removed: it added no
          // real SQL-injection protection on top of parameterization, but did
          // reject legitimate free-text notes (e.g. "asked patient to delete
          // old prescription").
          placeholders.push(`@${paramName}`);
          request.input(paramName, row[col]);
          paramCount++;
        });

        valuesClauses.push(`(${placeholders.join(', ')})`);
      });

      if (paramCount > 2100) {
        throw new Error(`Batch exceeds SQL parameter limit`);
      }

      const insertSql = `
        INSERT INTO [${table_name}] (${fields})
        OUTPUT INSERTED.[${primaryKeyField}]
        VALUES ${valuesClauses.join(', ')}
      `;

      const result = await request.query(insertSql);
      const insertedIds = result.recordset.map(r => r[primaryKeyField]);
      allInsertedIds.push(...insertedIds);
    }

    const lastInsertedId = allInsertedIds.length > 0
      ? Math.max(...allInsertedIds)
      : null;

    // return {
    //   statusCode: 200,
    //   message: "Insert completed successfully",
    //   totalInserted: allInsertedIds.length,
    //   insertedIds: lastInsertedId,
    //   batchesProcessed: batches.length
    // };
    return buildResponse(200,{message: "Insert completed successfully", totalInserted:allInsertedIds.length, insertedIds:lastInsertedId, batchesProcessed: batches.length},event);

  } catch (err) {
    console.error("❌ Error inserting data:", err);
    // return {
    //   statusCode: 500,
    //   message: "Internal server error",
    //   error: err.message
    // };
    return buildResponse(500,{ error: "", message: "Internal Server Error" },event);
  }
};