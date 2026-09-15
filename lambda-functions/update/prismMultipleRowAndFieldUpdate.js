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
//     max: 20,
//     min: 1,
//     idleTimeoutMillis: 300000,
//     acquireTimeoutMillis: 10000
//   }
// };

// // Create pool outside handler
// let connectionPoolPromise = sql.connect(config);

// async function getDBConnection() {
//   try {
//     const pool = await connectionPoolPromise;
//     return pool;
//   } catch (err) {
//     console.error("Reconnecting to SQL Server...", err.message);
//     connectionPoolPromise = sql.connect(config);
//     return await connectionPoolPromise;
//   }
// }
// ✅ Only allow safe column name pattern
function isValidColumnName(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

// ✅ Table + id-column allow-list, keyed by table. This endpoint lets the
// client pick BOTH the table and the WHERE-clause id column, so a plain
// identifier-syntax check isn't enough -- it doesn't stop a caller from
// updating a table (or a column within an allowed table) this endpoint was
// never meant to touch. Derived from every real call to
// multipleRowAndFieldUpdate() in the frontend (src/app) as of this review.
const ALLOWED_TABLES = {
  MEM_GAP_OBSERVATION_DATA: 'id',
  MEM_MEMBER_ACTION_FOLLOW_UP: 'id',
  MEM_OUTREACH_MEMBERS: 'medicaid_id'
};

exports.handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const { table_name, id_field_name, updates } = body;

  if (!table_name || !id_field_name || !Array.isArray(updates) || updates.length === 0) {
   // return { statusCode: 400, message: "Invalid input format." };
    return buildResponse(400,{ error: "Invalid input format." },event);
  }

  // ✅ Validate table name AND that id_field_name is the specific id column
  // allowed for that table -- not just any syntactically-valid identifier.
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_TABLES, table_name)
      || ALLOWED_TABLES[table_name] !== id_field_name) {
    return buildResponse(400,{ error: "Invalid table name" },event);
  }

  let pool, transaction;
  const executedQueries = [];

  try {
    pool = await getDBConnection();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    for (const record of updates) {
      const idValue = record[id_field_name];
      if (idValue === undefined || idValue === null) continue;

      const request = new sql.Request(transaction);
      const setClauses = [];

      let paramIndex = 0;

      for (const [key, value] of Object.entries(record)) {
        if (key === id_field_name) continue;

        // ✅ Validate column name dynamically. Values are bound below via
        // request.input(), which parameterizes them -- a content blacklist
        // was intentionally not added here: it would add no real
        // SQL-injection protection on top of parameterization, but would
        // reject legitimate free-text values (e.g. a note containing the
        // word "select" or "delete").
        if (!isValidColumnName(key)) continue;
        const paramName = `param${paramIndex++}`;
        setClauses.push(`[${key}] = @${paramName}`);

        request.input(paramName, value);
      }

      if (setClauses.length === 0) continue;

      request.input("id", idValue);

      const updateSql = `
        UPDATE [${table_name}]
        SET ${setClauses.join(", ")}
        WHERE [${id_field_name}] = @id
      `;

      executedQueries.push(updateSql.trim());
      await request.query(updateSql);
    }

    await transaction.commit();

    return buildResponse(200,{ message: "Bulk update successful",updatedCount: updates.length },event);

  } catch (err) {
    // executedQueries is logged server-side only -- it's raw generated SQL
    // and was previously being returned to the caller in the response body,
    // which is an information-disclosure risk.
    console.error("Error during bulk update:", err, { executedQueries });

    if (transaction) await transaction.rollback();

    return buildResponse(500,{ error: "Internal server error" },event);
  }
};
