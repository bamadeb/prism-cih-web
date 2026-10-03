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
//         encrypt: true,
//         trustServerCertificate: true
//     }
// };

// let poolPromise;

// async function getDBConnection() {
//     if (!poolPromise) {
//         poolPromise = sql.connect(config);
//     }
//     return poolPromise;
// }

// Finding 3.3.10: no auth check at all. This backs the pending
// user-creation-request queue (PII: name, phone, email) -- an Admin-only
// onboarding feature, same gate as prismUserslist.js/prismGetPageAccessList.js.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { message: "Unauthorized" }, event);
    }

    let pool;
    try {
        pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
            return buildResponse(403, { message: "Forbidden" }, event);
        }

        // Define SQL queries
        const queries = {             
           
            plist: `  SELECT  UCR.[ID],UCR.[ID] as id
                ,UCR.[FIRST_NAME]
                ,UCR.[LAST_NAME]
                ,UCR.[PHONE]
                ,UCR.[EMAIL]
                ,CONVERT(VARCHAR,UCR.[DATE_OF_REQUEST],101) AS DATE_OF_REQUEST
                ,UCR.[STATUS]
                ,CONVERT(VARCHAR,UCR.[ADDED_DATE],101) AS ADDED_DATE 
                ,UCR.[ADDED_BY] 
                ,U.FistName  
                ,R.ROLE_NAME
            FROM USER_CREATION_REQUEST AS UCR
            LEFT JOIN MEM_USERS AS U ON UCR.ADDED_BY = U.ID
            LEFT JOIN MEM_ROLE AS R ON UCR.ROLE_ID=R.ID
            ORDER BY UCR.[FIRST_NAME] ASC` 
        };
        // Run queries in parallel        

const [plist] = await Promise.all([
            pool.request().query(queries.plist),
            //pool.request().query(queries.prismPlandetailslist),
            //pool.request().query(queries.plist),
           // pool.request().query(queries.attachmentList),
        ]);

        // return {
        //     statusCode: 200,
        //     data: {
        //         //planlist: prismPlanlist.recordset,
        //         //plandetailslist: prismPlandetailslist.recordset,
        //         plans: plist.recordset,
        //         //attachments: attachmentList.recordset, 
        //     }
        // };
        return buildResponse(200,{ data: {plans: plist.recordset }},event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: "Internal Server Error", details: err.message }),
        // };
        return buildResponse(500,{ error: "Internal Server Error" },event);
    }
};
