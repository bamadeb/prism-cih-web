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
    let vendor_name = body.vendor_name;

    // Finding: no check at all that the caller is a known logged-in user.
    const claims = event.requestContext?.authorizer?.claims || {};
    if (!claims.sub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();       
        const result = await pool.request()
            .input('vendor_name', sql.VarChar, `%${vendor_name}%`) // Ensure it's treated as a string
            .query(`SELECT distinct C.[Vendor Last Name] as LAST_NAME, C.[Vendor ID] ,V.BILLING_ADDR_1 as VEND_ADDR_1_TXT
            ,V.BILLING_CITY as VEND_CITY_TXT, V.BILLING_STATE,V.BILLING_ZIP as VEND_ZIP_CD,v.NPI,v.VENDOR_NUM
            FROM PROVIDER_VENDOR_CROSSWALK as C
            JOIN dm.VENDOR AS V ON (C.[Vendor ID]=V.VENDOR_NUM)
            WHERE C.[Vendor Last Name] LIKE @vendor_name
            ORDER BY [Vendor Last Name] ASC`);  // Correct usage of parameter

        // return {
        //     statusCode: 200,
        //     data: result.recordset,
        // };
        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: err.message }),
        // };
        return buildResponse(500,{ error: "Internal server error" },event);
    } finally {
        if (pool) await pool.close();
    }
};

