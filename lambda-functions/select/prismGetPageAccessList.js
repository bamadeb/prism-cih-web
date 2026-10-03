const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//     user: conn.dbuser,
//     password: conn.dbpassword,
//     server: conn.dbhost,
//     database: conn.dbname,
//     port: 1433,
//     pool: {
//         max: 10,
//         min: 1,
//         idleTimeoutMillis: 30000
//     },
//     options: {
//         encrypt: true,                // for Azure; keep as needed
//         trustServerCertificate: true // set appropriately for your environment
//     }
// };

// // Start connecting at module load time (during Lambda init)
// let connectionPoolPromise = sql.connect(config)
//     .then(pool => {
//         console.log('DB connection pool established during init.');
//         // Optional: attach error handler to the pool
//         pool.on('error', err => {
//             console.error('Pool error:', err);
//             // if you want to force recreate on error:
//             connectionPoolPromise = recreatePoolPromise();
//         });
//         return pool;
//     })
//     .catch(err => {
//         console.error('Initial pool creation failed:', err);
//         // Keep the rejected promise so handler can attempt recreate.
//         // Optionally replace with a recreated promise:
//         connectionPoolPromise = recreatePoolPromise();
//         return connectionPoolPromise;
//     });

// // Helper to recreate the pool if needed
// function recreatePoolPromise() {
//     console.log('Recreating DB connection pool...');
//     return sql.connect(config)
//         .then(pool => {
//             console.log('Recreated DB connection pool.');
//             pool.on('error', err => {
//                 console.error('Pool error:', err);
//                 connectionPoolPromise = recreatePoolPromise();
//             });
//             return pool;
//         })
//         .catch(err => {
//             console.error('Recreate pool failed:', err);
//             // Wait a bit before trying again to avoid tight loop (optional)
//             return new Promise((resolve, reject) => {
//                 setTimeout(() => {
//                     recreatePoolPromise().then(resolve).catch(reject);
//                 }, 2000);
//             });
//         });
// }

// PAGE ACCESS is an Admin-only page; this endpoint had no auth check at all.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
        return buildResponse(401, { error: "Unauthorized" }, event);
    }

    try {
        // Await the pool promise (either initial or recreated)
        const pool = await getDBConnection();

        const callerLookup = await pool.request()
            .input('cognito_username', sql.VarChar, callerSub)
            .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
        const caller = callerLookup.recordset[0];
        if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
            return buildResponse(403, { error: "Forbidden" }, event);
        }

        // Queries
        const queries = {
            PageAccessList: ` SELECT t.[id]
                ,t.[role_id]
                ,t.[page_id]
                ,t.[status]
                ,CASE 
                    WHEN t.[status] = 0 THEN 'Active'
                    ELSE 'Inactive'
                END AS status_text
                ,r.ROLE_NAME
                ,p.page_name
            FROM ROLE_PAGE_ACCESS as t
            LEFT JOIN MEM_ROLE as r ON t.role_id = r.id
            LEFT JOIN MST_PAGES AS p ON t.page_id = p.id  `,
            PageList: `SELECT  [id]
                        ,[page_name]
                        ,[page_code]
                        ,[status]
                    FROM MST_PAGES `,
            roleList: `SELECT [ID]
                    ,[ROLE_NAME]
                    ,[SHORT_ORDER]
                    ,[STATUS]
                    ,[NEW_STATUS]
                FROM [MEM_ROLE]
                WHERE [NEW_STATUS] ='0' `       
        };


        // Run queries in parallel using the same pool
        const [PageAccessList,PageList,roleList] = await Promise.all([
            pool.request().query(queries.PageAccessList),
            pool.request().query(queries.PageList),
            pool.request().query(queries.roleList)
        ]);

        // return {
        //     statusCode: 200,
        //     data: {
        //         PageAccessList: PageAccessList.recordset,
        //         PageList: PageList.recordset,
        //         roleList: roleList.recordset
        //     }
        // };

        return buildResponse(200,{  data: {PageAccessList: PageAccessList.recordset,PageList: PageList.recordset,roleList: roleList.recordset } },event);
    } catch (err) {
        console.error('Handler error:', err);
        // return {
        //     statusCode: 500,
        //     data: JSON.stringify({ error: "Internal Server Error", details: err.message }),
        // };

        return buildResponse(500,{error: "Internal Server Error" },event);
    }
};
