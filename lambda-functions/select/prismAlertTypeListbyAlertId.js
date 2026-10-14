const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// var conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser, 
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433, 
//     options: {
//         encrypt: true, // Required for Azure SQL; set to false for on-premises
//         trustServerCertificate: true // Set true if using self-signed certificates
//     }
// };

// let poolPromise;
// async function getDBConnection() {
//     if (!poolPromise) {
//         poolPromise = sql.connect(config);
//     }
//     return poolPromise;
// }

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    const body = JSON.parse(event.body || "{}");
    var alert_id = body.alert_id;
    //var alert_id = 7;

    // var filter_sql = "";
    // if (typeof user_id !== 'undefined') {
    //     filter_sql += " AND U.EmailID='"+username+"' AND U.Password='"+password+"' ";
    // }

    // Finding: no check at all that the caller is a known logged-in user.
    const claims = event.requestContext?.authorizer?.claims || {};
    if (!claims.sub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();
        const result = await pool.request().input('alert_id', sql.Int, alert_id).query(`SELECT  [id]
        ,[parent_id]
        ,[alert]
        ,[status]
  FROM [dbo].[MEM_ALERTS]
    WHERE parent_id =@alert_id
    AND status =0
    ORDER BY [alert] ASC`);
        
        
        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        return buildResponse(500,{ message: "Internal server error" },event);
    } finally {
        if (pool) await pool.close();
    }
};
