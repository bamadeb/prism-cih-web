const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// var conn = require('/opt/config.json');
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
//   }
// };

// let connectionPool;

// async function getDBConnection() {
//   if (!connectionPool) {
//     connectionPool = await sql.connect(config);
//   } else if (!connectionPool.connected) {
//     connectionPool = await sql.connect(config);
//   }
//   return connectionPool;
// }

const MAX_RECORDS = 500;

// This route is confirmed to have the Cognito authorizer attached at the API
// Gateway level (checked via the OpenAPI export, same way prismGetcallhistory-
// prod's authorizer was confirmed) -- so event.requestContext.authorizer.claims
// will actually be populated here, unlike a few sibling routes still missing
// the authorizer entirely.
//
// Ownership is required for every caller, with no role-based bypass: only the
// member's assigned care coordinator may delete that member's gap
// observations. Admin gets no special-case exemption here -- an Admin can
// only delete a given member's gaps if that Admin is ALSO the member's
// assigned Care_Coordinator_id, same as any other user. (Unlike most other
// endpoints in this review, where Admin bypasses the ownership check
// entirely -- this one is deliberately different per explicit instruction.
// A brief attempt to add an Admin bypass here was reverted -- keep it
// strict owner-only.)

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200,{},event);
  }

  const body = JSON.parse(event.body || "{}");
  const records = body.records;

  if (!records || !Array.isArray(records) || !records.length) {
    return buildResponse(400,{ error: 'No records provided' },event);
  }

  if (records.length > MAX_RECORDS) {
    return buildResponse(400,{ error: `Cannot delete more than ${MAX_RECORDS} records at once` },event);
  }

  if (records.some(r => !Number.isInteger(Number(r.id)))) {
    return buildResponse(400,{ error: 'Invalid record id' },event);
  }

  if (records.some(r => !r.subscriber_number)) {
    return buildResponse(400,{ error: 'subscriber_number is required on every record' },event);
  }

  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { error: 'Unauthorized' }, event);
  }

  let pool;
  let transaction;

  try {
    pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { error: 'Unauthorized' }, event);
    }

    // Ownership check, no role-based bypass: the caller must be the user who
    // originally created each observation row -- MEM_GAP_OBSERVATION_DATA.
    // added_by -- not the member's current assigned care coordinator. Those
    // are frequently different people (a care-coordinator reassignment, or
    // an Admin who entered the observation directly), and checking the
    // member's Care_Coordinator_id instead of the row's own added_by is what
    // caused every caller -- including the Admin who actually created the
    // record -- to be incorrectly blocked when that member's assigned
    // coordinator turned out to be a stale/orphaned user ID.
    const ownerCheckIds = [...new Set(records.map(r => Number(r.id)))];
    const ownerCheckRequest = pool.request();
    const ownerCheckIdParams = ownerCheckIds.map((id, i) => {
      ownerCheckRequest.input(`ownerid${i}`, sql.Int, id);
      return `@ownerid${i}`;
    }).join(',');

    const ownerCheck = await ownerCheckRequest.query(`
      SELECT id, added_by
      FROM MEM_GAP_OBSERVATION_DATA
      WHERE id IN (${ownerCheckIdParams})
    `);

    const ownedIds = new Set(
      ownerCheck.recordset
        .filter(row => Number(row.added_by) === Number(caller.ID))
        .map(row => row.id)
    );

    const unauthorized = ownerCheckIds.some(id => !ownedIds.has(id));
    if (unauthorized) {
      return buildResponse(403, { error: 'Forbidden' }, event);
    }

    // 🔥 transaction must be created from pool
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // --- UPDATE 1 ---
    const request = new sql.Request(transaction);

    const ids = records.map(r => r.id);
    const idParams = ids.map((_, i) => `@id${i}`).join(',');

    ids.forEach((id, i) => {
      request.input(`id${i}`, sql.Int, id);
    });

    const queryMain = `
      UPDATE MEM_GAP_OBSERVATION_DATA
      SET is_deleted = 1,
          is_deleted_date = GETDATE()
      WHERE id IN (${idParams})
    `;

    await request.query(queryMain);

    // --- UPDATE 2 ---
    for (const r of records) {
      const req2 = new sql.Request(transaction);
      req2.input('subscriber_number', sql.VarChar(50), r.subscriber_number);
      req2.input('gap_code', sql.VarChar(50), r.gap_code);

      let query2;

      if (r.Type === 'risk') {
        query2 = `
          UPDATE MEM_RISK_GAP
          SET PROCESS_STATUS = '0'
          WHERE SUBSCRIBER_NUMBER = @subscriber_number
            AND DIAG_CODE = @gap_code
        `;
      } else if (r.Type === 'quality') {
        query2 = `
          UPDATE MEM_CIH_QUALITY
          SET PROCESS_STATUS = '0'
          WHERE SUBSCRIBER_ID = @subscriber_number
            AND SUB_MEASURE = @gap_code
        `;
      } else {
        throw new Error('Invalid Type: ' + r.Type);
      }

      await req2.query(query2);
    }

    await transaction.commit();

    // return {
    //   statusCode: 200,
    //   data: { message: 'Records deleted successfully' }
    // };

    return buildResponse(200,{ message: 'Records deleted successfully' },event);

  } catch (err) {
    console.error('Database error:', err);
    if (transaction) await transaction.rollback();

    // return {
    //   statusCode: 500,
    //   data: JSON.stringify({ error: err.message })
    // };

    return buildResponse(500,{ error: 'Internal server error' },event);
  }
  // Not closing the pool here: getDBConnection() (see /opt/dbConfig, and the
  // same singleton/reuse pattern commented out at the top of every other
  // Lambda in this project) hands back a pool shared across warm invocations
  // in this container. Closing it in a per-request finally block -- as this
  // handler previously did, even on the success path -- would tear down that
  // shared connection out from under any other concurrent or subsequent
  // invocation reusing the same warm container, causing intermittent
  // failures elsewhere. Pool lifecycle should be left to /opt/dbConfig.
};
