
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
// Finding 3.4.7: medicaid_id came straight from the client with no check
// that the caller is that member's assigned care coordinator -- same gap as
// its three siblings (prismUnSetMemberGapsStatus.js, prismUpdategapStatus.js,
// prismUpdatequalityStatus.js), all fixed the same way. Admin bypasses.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const { action_id, medicaid_id } = body;

  try {
    if (event.httpMethod === "OPTIONS") {
      return buildResponse(200,{},event);
    }

    if (!medicaid_id) {
      return buildResponse(400, { error: "medicaid_id is required" }, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { error: "Unauthorized" }, event);
    }

    const pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(401, { error: "Unauthorized" }, event);
    }

    if (Number(caller.role_id) !== ADMIN_ROLE_ID) {
      const assignmentLookup = await pool.request()
        .input('medicaid_id', sql.VarChar, medicaid_id)
        .query('SELECT Care_Coordinator_id FROM MEM_OUTREACH_MEMBERS WHERE medicaid_id = @medicaid_id');
      const member = assignmentLookup.recordset[0];
      if (!member || Number(member.Care_Coordinator_id) !== Number(caller.ID)) {
        return buildResponse(403, { error: "Forbidden" }, event);
      }
    }

    const result = await pool.request()
      .input('action_id', sql.VarChar, action_id)
      .input('medicaid_id', sql.VarChar, medicaid_id)
      .query(`
        UPDATE QU 
        SET QU.PROCESS_STATUS = '0', 
            QU.UPDATE_DATE = GETDATE(), 
            QU.ACTION_ID = @action_id
        FROM MEM_CIH_QUALITY AS QU
        WHERE QU.MEDICAID_ID = @medicaid_id           
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

    //return { statusCode: 200, data: result.rowsAffected };
    return buildResponse(200,{ data: result.rowsAffected },event);
  } catch (err) {
    console.error('Database connection error:', err);
    //return { statusCode: 500, error: err.message };
    return buildResponse(500,{ error: 'Interna server error.' },event);
  }
};

