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

exports.handler = async (event) => {
    //event.type_id ='1';
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200, {}, event);
    }

    // Finding 3.3.10: no auth check at all. This is reference/lookup data
    // (plan definitions, not member-specific), so only a baseline
    // "must be a real logged-in user" check is needed -- no ownership scope.
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
            .query('SELECT ID FROM MEM_USERS WHERE cognito_username = @cognito_username');
        if (!callerLookup.recordset[0]) {
            return buildResponse(401, { message: "Unauthorized" }, event);
        }

        // Define SQL queries
        const queries = {             
           
            plist: ` SELECT [id]
                ,[plan_name]
                ,CONVERT(VARCHAR,[start_date],101) AS start_date
                ,CONVERT(VARCHAR,[end_date],101) AS end_date 
                ,[status]
            FROM MEM_PLAN_MASTER
            ORDER BY [plan_name] ASC` 

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
        return buildResponse(200,{ data: {plans: plist.recordset}},event);
    } catch (err) {
        console.error('Database connection error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: "Internal Server Error", details: err.message }),
        // };

        return buildResponse(500,{ error: "Internal Server Error"},event);
    }
};
