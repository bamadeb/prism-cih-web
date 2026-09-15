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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200,{},event);
  }
  const body = JSON.parse(event.body || "{}");   
    var diagVal = body.diag_codes; 
    var action_id = body.action_id; 
    var medicaid_id = body.medicaid_id; 

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
        return buildResponse(400,{error: "Invalid diag_codes"},event);
    }

    if (diagArray.length === 0) {
       // return { statusCode: 400, error: "Empty diag_codes" };
        return buildResponse(400,{error: "Empty diag_codes"},event);
    }

    var filter_sql = "";
    if (typeof action_id == 'undefined') {
      action_id = 0; 
    }
    // ✅ Validate inputs
    // if (!Array.isArray(diagVal) || diagVal.length === 0) {
    //   return { statusCode: 400, error: "Invalid diag_codes" };
    // }

    let pool;
    try {
  //     return `UPDATE g SET g.PROCESS_STATUS='1',g.UPDATE_DATE=GETDATE(),g.ACTION_ID='` + action_id + `'
  //  FROM MEM_MEMBERS AS m LEFT JOIN  MEM_RISK_GAP as g ON(m.SUBSCRIBER_NUMBER=g.SUBSCRIBER_NUMBER)
  //  WHERE m.RECIP_NO = '` + medicaid_id + `' AND DIAG_CODE IN (${diagVal}) AND g.PROCESS_STATUS='0'`;
   
        pool = await getDBConnection();
        const request = pool.request();

        request.input('action_id', sql.Int, action_id);
        request.input('medicaid_id', sql.VarChar(20), medicaid_id);
        // ✅ Safe IN clause
      //   const diagParams = diagVal.map((val, i) => {
      //     const param = `diag${i}`;
      //     request.input(param, sql.VarChar(50), val);
      //     return `@${param}`;
      // });
        // ✅ Safe IN clause
        const diagParams = diagArray.map((val, i) => {
          const param = `diag${i}`;
          request.input(param, sql.VarChar(50), val);
          return `@${param}`;
      });                      
        const query =`UPDATE g SET g.PROCESS_STATUS='1',g.UPDATE_DATE=GETDATE(),g.ACTION_ID= @action_id
   FROM MEM_MEMBERS AS m LEFT JOIN  MEM_RISK_GAP as g ON(m.SUBSCRIBER_NUMBER=g.SUBSCRIBER_NUMBER)
   WHERE m.RECIP_NO = @medicaid_id AND DIAG_CODE IN (${diagParams.join(',')})`;
        const result = await request.query(query);
        // return {
        //     statusCode: 200,
        //     data: result.recordset,
            
        // };
        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ message: "Internal Server Error" },event);
    }
};
