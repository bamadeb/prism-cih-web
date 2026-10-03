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

// // Create pool outside handler, once per container
// let connectionPoolPromise = sql.connect(config);

// async function getDBConnection() {
//   try {
//     return await connectionPoolPromise;
//   } catch (err) {
//     console.error("Reconnecting to SQL Server...", err.message);
//     connectionPoolPromise = sql.connect(config);
//     return await connectionPoolPromise;
//   }
// }

// Finding 3.4.7: medicaid_id came straight from the client with no check
// that the caller is that member's assigned care coordinator. Admin
// bypasses, matching the pattern used for reads on this same data.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }

    const body = JSON.parse(event.body || "{}");
    const diagVal = body.measur_code_val;
    const action_id = body.action_id ?? 0;
    const medicaid_id = body.medicaid_id;

    if (!medicaid_id) {
        return buildResponse(400, { error: "medicaid_id is required" }, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { error: "Unauthorized" }, event);
    }

    // ✅ Convert to array safely
    let diagArray;

    if (Array.isArray(diagVal)) {
        diagArray = diagVal;
    } else if (typeof diagVal === 'string') {
        diagArray = diagVal
            .split(',')
            .map(v => v.replace(/'/g, '').trim())
            .filter(v => v.length > 0);
    } else {
        //return { statusCode: 400, error: "Invalid diag_codes" };
        return buildResponse(400,{ error: "Invalid diag_codes" },event);
    }

    if (diagArray.length === 0) {
        //return { statusCode: 400, error: "Empty diag_codes" };
        return buildResponse(400,{ error: "Empty diag_codes" },event);
    }

    let pool;
    try {
        pool = await getDBConnection();

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

        const request = pool.request();
        const diagParams = diagArray.map((val, i) => {
          const param = `diag${i}`;
          request.input(param, sql.VarChar(50), val);
          return `@${param}`;
        });        
        request.input('action_id', sql.Int, action_id);
        request.input('medicaid_id', sql.VarChar, medicaid_id);
  //       const result = await pool.request().query(`UPDATE QU SET QU.PROCESS_STATUS='1', QU.UPDATE_DATE=GETDATE(), QU.ACTION_ID= '`+ action_id +`'
  //  FROM MEM_MEMBERS AS m LEFT JOIN MEM_CIH_QUALITY AS QU ON(m.SUBSCRIBER_NUMBER=QU.SUBSCRIBER_ID) WHERE m.RECIP_NO = '`+ medicaid_id +`' AND QU.SUB_MEASURE IN (${measur_code_val})`);
        const query = `UPDATE QU SET QU.PROCESS_STATUS='1', QU.UPDATE_DATE=GETDATE(), QU.ACTION_ID= @action_id
   FROM MEM_MEMBERS AS m LEFT JOIN MEM_CIH_QUALITY AS QU ON(m.SUBSCRIBER_NUMBER=QU.SUBSCRIBER_ID) 
   WHERE m.RECIP_NO = @medicaid_id AND QU.SUB_MEASURE IN (${diagParams.join(',')})`;
   
   const result = await request.query(query);
        // return {
        //     statusCode: 200,
        //     data: result.recordset,            
        // };
        return buildResponse(200,{ data: result.recordset },event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: err.message }),
        // };
        return buildResponse(500,{ error: "Internal server error" },event);
    }
};
