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
//     trustServerCertificate: true,
//   },
//   pool: {
//     max: 10,
//     min: 1,
//     idleTimeoutMillis: 60000,
//     acquireTimeoutMillis: 5000,
//   },
// };

// let poolPromise;

// async function getDBConnection() {
//   if (!poolPromise) {
//     poolPromise = sql.connect(config);
//   }
//   try {
//     return await poolPromise;
//   } catch (err) {
//     console.error("Reconnecting to SQL Server...", err.message);
//     poolPromise = sql.connect(config);
//     return await poolPromise;
//   }
// }
exports.handler = async (event) => {
  //const { action_id, medicaid_id } = event;
  const body = JSON.parse(event.body || "{}");
  const action_id = body.action_id ?? 0;
  const medicaid_id = body.medicaid_id;

  // Both UPDATE statements below are scoped by medicaid_id (as well as
  // PROCESS_STATUS = '1'), so a missing/invalid medicaid_id can't broadly
  // affect other members -- but it should still be rejected explicitly
  // rather than silently running a query that matches zero rows.
  if (!medicaid_id) {
    return buildResponse(400, { error: "medicaid_id is required" }, event);
  }

  try {
    const pool = await getDBConnection();
    const result = await pool.request()
      .input('action_id', sql.Int, action_id)
      .input('medicaid_id', sql.VarChar, medicaid_id)
      .query(`
        UPDATE QU 
        SET QU.PROCESS_STATUS = '0', 
            QU.UPDATE_DATE = GETDATE(), 
            QU.ACTION_ID = @action_id
        FROM MEM_CIH_QUALITY AS QU
        WHERE QU.MEDICAID_ID = @medicaid_id 
          AND QU.NUMERATOR_GAP = '0' 
          AND QU.PROCESS_STATUS = '1';
          -- Update Risk Gaps
      UPDATE g
      SET g.PROCESS_STATUS = '0',
          g.UPDATE_DATE = GETDATE(),
          g.ACTION_ID = @action_id
      FROM MEM_MEMBERS AS m
      LEFT JOIN MEM_RISK_GAP AS g
        ON m.SUBSCRIBER_NUMBER = g.SUBSCRIBER_NUMBER
      WHERE m.RECIP_NO = @medicaid_id
        AND g.PROCESS_STATUS = '1'
      `);

   // return { statusCode: 200, data: result.rowsAffected };
    return buildResponse(200,{ data: result.rowsAffected },event);
  } catch (err) {
    console.error('Database connection error:', err);
    //return { statusCode: 500, error: err.message };
    return buildResponse(500,{ error: "Internal server error" },event);
  }
};

