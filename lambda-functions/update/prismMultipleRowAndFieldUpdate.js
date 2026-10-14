const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

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

// Columns each table may set.
//  - MEM_OUTREACH_MEMBERS: the Transfer Member dialog only reassigns the care
//    coordinator, so restrict writes to that single column.
//  - MEM_GAP_OBSERVATION_DATA / MEM_MEMBER_ACTION_FOLLOW_UP: these ARE edited
//    by non-admins (the add-action gap/observation and action edit forms in
//    add-action.ts), each writing ~many of the row's own columns. A fixed
//    column allow-list here was both wrong ("no screen uses these") and
//    brittle, so `null` now means "any syntactically-valid column, but gated
//    by row ownership below" -- NOT "admin only". The security boundary for
//    these two is MEMBER_OWNED_BY_ID: you may only update rows belonging to a
//    member assigned to you.
const ALLOWED_COLUMNS = {
  MEM_OUTREACH_MEMBERS: ['Care_Coordinator_id'],
  MEM_GAP_OBSERVATION_DATA: null,
  MEM_MEMBER_ACTION_FOLLOW_UP: null
};

// Tables keyed by `id` whose rows carry a medicaid_id: a non-admin may only
// update a row whose owning member -- resolved from the row in the DB, never
// trusted from the request body -- is assigned to them.
const MEMBER_OWNED_BY_ID = new Set(['MEM_GAP_OBSERVATION_DATA', 'MEM_MEMBER_ACTION_FOLLOW_UP']);

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

    // Row-ownership gate for the member-data tables that non-admins legitimately
    // edit (gap observations, member actions). The owning member is resolved
    // from the row in the DB by its id -- never trusted from the request body --
    // and must be assigned to the caller. This replaces the former blanket
    // "null columns => admin only" gate, which wrongly blocked these forms.
    if (!isAdmin && MEMBER_OWNED_BY_ID.has(table_name)) {
      const allHaveValidId = updates.every(u => {
        const v = u[id_field_name];
        return v !== undefined && v !== null && /^\d+$/.test(String(v));
      });
      if (!allHaveValidId) {
        return buildResponse(400, { error: "Each update must have a valid numeric id" }, event);
      }
      const ids = [...new Set(updates.map(u => Number(u[id_field_name])))];
      const ownReq = pool.request();
      const ph = ids.map((id, i) => { ownReq.input(`rid${i}`, sql.Int, id); return `@rid${i}`; });
      const owned = await ownReq.query(
        `SELECT t.[${id_field_name}] AS rid, o.Care_Coordinator_id AS cc
           FROM [${table_name}] t
           LEFT JOIN MEM_OUTREACH_MEMBERS o ON o.medicaid_id = t.medicaid_id
          WHERE t.[${id_field_name}] IN (${ph.join(', ')})`);
      const ownerById = new Map(
        owned.recordset.map(r => [Number(r.rid), (r.cc === null || r.cc === undefined) ? null : Number(r.cc)])
      );
      // Every requested id must exist AND resolve to a member assigned to the
      // caller; a missing id (get() === undefined) also fails this check.
      for (const id of ids) {
        if (ownerById.get(id) !== Number(caller.ID)) {
          return buildResponse(403, { error: "Forbidden" }, event);
        }
      }
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
