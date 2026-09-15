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
    // var diagVal = event.measur_code_val;
    // var action_id = event.action_id ?? 0; 
    // var medicaid_id = event.medicaid_id; 

    const body = JSON.parse(event.body || "{}");
    const diagVal = body.measur_code_val;   
    const action_id = body.action_id ?? 0;   
    const medicaid_id = body.medicaid_id;    

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
