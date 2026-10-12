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

// Columns each table may set. MEM_OUTREACH_MEMBERS is the Transfer Member
// dialog, which only reassigns the care coordinator.
const ALLOWED_COLUMNS = {
  MEM_OUTREACH_MEMBERS: ['Care_Coordinator_id'],
  MEM_GAP_OBSERVATION_DATA: null,       // no screen uses these two -> Admin only
  MEM_MEMBER_ACTION_FOLLOW_UP: null
};

const ADMIN_ROLE_ID = 7;
const MAX_ROWS = 500;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { error: "Unauthorized" }, event);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return buildResponse(400, { error: "Invalid JSON body" }, event);
  }
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

  if (updates.length > MAX_ROWS) {
    return buildResponse(400, { error: `At most ${MAX_ROWS} rows per request` }, event);
  }

  const allowedColumns = ALLOWED_COLUMNS[table_name];
  if (allowedColumns) {
    for (const record of updates) {
      const bad = Object.keys(record).find(k => k !== id_field_name && !allowedColumns.includes(k));
      if (bad) {
        return buildResponse(400, { error: `Column not allowed: ${bad}` }, event);
      }
    }
  }

  let pool, transaction;
  const executedQueries = [];

  try {
    pool = await getDBConnection();
    transaction = new sql.Transaction(pool);
    // ---- Authorization (before any write) ----
    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(403, { error: "Forbidden" }, event);
    }
    const isAdmin = Number(caller.role_id) === ADMIN_ROLE_ID;

    if (!allowedColumns && !isAdmin) {
      return buildResponse(403, { error: "Forbidden" }, event);
    }

    if (table_name === 'MEM_OUTREACH_MEMBERS') {
      const ids = [...new Set(updates.map(u => u.medicaid_id).filter(v => v !== undefined && v !== null).map(String))];
      const targets = [...new Set(updates.map(u => u.Care_Coordinator_id).filter(v => v !== undefined))];

      // The new coordinator must be a real user.
      if (targets.some(t => !/^\d+$/.test(String(t)))) {
        return buildResponse(400, { error: "Invalid Care_Coordinator_id" }, event);
      }
      if (targets.length) {
        const userReq = pool.request();
        targets.forEach((t, i) => userReq.input(`u${i}`, sql.Int, Number(t)));
        const found = await userReq.query(
          `SELECT ID FROM MEM_USERS WHERE ID IN (${targets.map((_, i) => `@u${i}`).join(', ')})`);
        if (found.recordset.length !== targets.length) {
          return buildResponse(400, { error: "Unknown Care_Coordinator_id" }, event);
        }
      }

      // Non-admins may only transfer members they currently own -- otherwise
      // anyone could assign any member to themselves and bypass every
      // ownership check in the other Lambdas.
      if (!isAdmin && ids.length) {
        const ownReq = pool.request();
        ids.forEach((id, i) => ownReq.input(`m${i}`, sql.VarChar, id));
        const owned = await ownReq.query(
          `SELECT medicaid_id, Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS
           WHERE medicaid_id IN (${ids.map((_, i) => `@m${i}`).join(', ')})`);
        const ownerMap = new Map(owned.recordset.map(r => [String(r.medicaid_id), Number(r.Care_Coordinator_id)]));
        if (ids.some(id => ownerMap.get(id) !== Number(caller.ID))) {
          return buildResponse(403, { error: "Forbidden" }, event);
        }
      }
    }

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

    // The transaction may not have begun (e.g. an auth query failed first).
    if (transaction) await transaction.rollback().catch(() => {});

    return buildResponse(500,{ error: "Internal server error" },event);
  }
};
