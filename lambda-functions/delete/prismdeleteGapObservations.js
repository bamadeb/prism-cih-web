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

exports.handler = async (event) => {
  // TODO(authorization): these ids/subscriber_number values come straight
  // from the client with no check that the caller has access to the members
  // they belong to. Wire in an ownership check here once the auth-claims
  // shape reaching this Lambda is confirmed (e.g.
  // event.requestContext.authorizer.claims).

  //const records = event.records;
  const body = JSON.parse(event.body || "{}");
  const records = body.records;

  if (!records || !Array.isArray(records) || !records.length) {
    // return {
    //   statusCode: 400,
    //   data: JSON.stringify({ error: 'No records provided' })
    // };
    return buildResponse(400,{ error: 'No records provided' },event);
  }

  if (records.length > MAX_RECORDS) {
    return buildResponse(400,{ error: `Cannot delete more than ${MAX_RECORDS} records at once` },event);
  }

  if (records.some(r => !Number.isInteger(Number(r.id)))) {
    return buildResponse(400,{ error: 'Invalid record id' },event);
  }

  let pool;
  let transaction;

  try {
    pool = await getDBConnection();

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
