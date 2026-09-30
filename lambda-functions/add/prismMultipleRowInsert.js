const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

// ✅ Validate identifier (table/column)
function isValidName(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

// ✅ Table allow-list. This endpoint is generic (client supplies table_name +
// insertDataArray), so isValidName() alone only proves the name is *syntactically*
// safe as an identifier -- it does NOT stop a caller from writing to a table this
// endpoint was never meant to touch. Mirrors the allow-list in prismMultipleinsert.js
// -- keep the two in sync if a new table is added there.
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
  'MEM_STAR_PERFORMANCE_REPORT_DATA_TEMP',
  'MEM_MEMBERS_TEMP',
  'MEM_RISK_GAP_TEMP',
  'MEM_CIH_PCR_TEMP',
  'MEM_CIH_QUALITY_TEMP'
]);

// ✅ Required-field map, keyed by table. Mirrors prismMultipleinsert.js -- see that
// file for which tables are deliberately left out and why.
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
  MEM_REFERRING: ['medicaid_id', 'refer_to', 'refer_by']
};

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// ✅ Map a JS value to the tedious/mssql column type used for the bulk load.
function inferSqlType(value) {
  if (typeof value === 'number') return sql.Int;
  if (typeof value === 'boolean') return sql.Bit;
  if (value instanceof Date) return sql.DateTime;
  return sql.NVarChar(sql.MAX);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200,{},event);
  }
  const body = JSON.parse(event.body || "{}");
  const { table_name, insertDataArray } = body;

  if (!Array.isArray(insertDataArray) || insertDataArray.length === 0) {
    return buildResponse(400,{ message: "insertDataArray must be a non-empty array." },event);
  }

  // ✅ Validate table name against the allow-list (isValidName alone only
  // proves it's a syntactically safe identifier, not that it's a table this
  // endpoint is allowed to write to).
  if (!isValidName(table_name) || !ALLOWED_TABLES.has(table_name)) {
    return buildResponse(400,{ message: "Invalid table name." },event);
  }

  // ✅ Required-field check -- checks every row, not just insertDataArray[0],
  // since a batch could mix a valid row with an incomplete one.
  const requiredFields = REQUIRED_FIELDS[table_name];
  if (requiredFields) {
    for (const row of insertDataArray) {
      const missing = requiredFields.filter(field => isBlank(row[field]));
      if (missing.length > 0) {
        return buildResponse(400, { message: `Missing required field(s): ${missing.join(', ')}` }, event);
      }
    }
  }

  // ✅ Validate columns
  const columns = Object.keys(insertDataArray[0]).filter(col => isValidName(col));
  if (columns.length === 0) {
    return buildResponse(400,{ message: "No valid columns provided" },event);
  }

  try {
    const pool = await getDBConnection();

    const table = new sql.Table(table_name);
    table.create = false; // Table already exists

    const sampleRow = insertDataArray[0];
    columns.forEach(col => {
      table.columns.add(col, inferSqlType(sampleRow[col]), { nullable: true });
    });

    // Bind every row to the validated column set/order, rather than trusting
    // each row's own key order -- a row with a missing or reordered key would
    // otherwise misalign values against columns.
    insertDataArray.forEach(row => {
      table.rows.add(...columns.map(col => row[col] ?? null));
    });

    await pool.request().bulk(table);

    return buildResponse(200,{ message: "Insert successful", totalInserted: insertDataArray.length },event);

  } catch (err) {
    console.error("❌ Error inserting data:", err);
    return buildResponse(500,{ message: "Internal Server Error" },event);
  }
};
