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
    let vendor_id = body.vendor_id;
    let doctor_name = body.doctor_name;
    //vendor_id = 'HSC8001';
    //doctor_name = 'd';

    // Finding: no check at all that the caller is a known logged-in user.
    const claims = event.requestContext?.authorizer?.claims || {};
    if (!claims.sub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();     
        const result = await pool.request()
            .input('vendor_id', sql.VarChar, vendor_id)
            .input('doctor_name', sql.VarChar, `%${doctor_name}%`)
            .query(`SELECT  distinct pvc.[Provider ID] AS PROVIDER_ID, CONCAT(pvc.[Provider First Name],' ',pvc.[Provider Last Name]) AS NAME,P.NPI_NUM ,prv.PAR_NONPAR ,P.PRIMARY_BUSINESS_ADDR1 ,P.PRIMARY_BUSINESS_CITY,P.PRIMARY_BUSINESS_STATE ,	P.PRIMARY_BUSINESS_ZIP,P.P_S_FLAG,S.SPEC_DESC

            FROM PROVIDER_VENDOR_CROSSWALK pvc
            JOIN dm.PROV_REGION_VENDOR prv ON (pvc.[Provider ID]=prv.PROVIDER AND pvc.[Vendor ID]=prv.PHYS_VENDOR AND prv.PAR_NONPAR='P')
            LEFT JOIN MEM_PHYSICIAN  AS P ON(pvc.[Provider ID]=P.PROVIDER_ID)
            LEFT JOIN [dm].[R_SPECIALTY] S  ON (P.PRIMARY_SPECIALTY=S.SPEC_CD)
            WHERE pvc.[Vendor ID]= @vendor_id 
            AND (pvc.[Provider First Name] LIKE @doctor_name OR  pvc.[Provider Last Name] LIKE @doctor_name )
            ORDER BY NAME ASC`);  // Correct usage of parameter

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
        return buildResponse(500,{ error: "", message: "Internal Server Error" },event);
    } finally {
        if (pool) await pool.close();
    }
};

