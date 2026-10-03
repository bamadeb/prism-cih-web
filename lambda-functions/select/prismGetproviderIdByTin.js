const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// var conn = require('/opt/config.json')
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser,
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433,
//     options: {
//         encrypt: true,
//         trustServerCertificate: true
//     }
// };

// let connectionPool;

// async function getDBConnection() {
//     if (!connectionPool) {
//         connectionPool = await sql.connect(config);
//     } else if (!connectionPool.connected) {
//         connectionPool = await sql.connect(config);
//     }
//     return connectionPool;
// }

// Finding 3.3.1: tin was bound with no format/length validation, letting
// malformed input reach the query and risk a driver-level TDS error
// disclosure. TINs are 9-digit numeric identifiers.
const TIN_RE = /^\d{9}$/;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    const body = JSON.parse(event.body || "{}");
    const tin = body.tin;

    if (!tin || !TIN_RE.test(tin)) {
        return buildResponse(400, { error: "A valid 9-digit tin is required" }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();

        const request = pool.request();    
        request.input('tin', sql.VarChar(20), tin);

        const query = `SELECT distinct [Provider_ID],Provider_Name
                    FROM MEM_CIH_QUALITY_TEMP
                    WHERE [Provider_TIN]=@tin `;

        const result = await request.query(query);

        // return {
        //     statusCode: 200,
        //     data: result.recordset
        // };
        return buildResponse(200,{ data: result.recordset },event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: err.message })
        // };

        return buildResponse(500,{ error: "Internal Server Error" },event);
    }
};
