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

// Finding 3.3.10: no auth check at all. Also fixing a live bug found during
// this review -- the role-exclusion filter below referenced `roleIds`, an
// undeclared variable (the parsed value was actually stored as `role_id`),
// so this function threw a ReferenceError and returned a 500 on every call
// regardless of whether a role filter was supplied.
exports.handler = async (event) => {
    //event.role_id = '7,20';
    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
      }
      const body = JSON.parse(event.body || "{}");
    var role_id = body.role_id;

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

        const request = pool.request();
        let query =` SELECT  U.[ID],[initial],[FistName],[LastName],[EmailID],[member_role]
  ,member_status,role_id,R.ROLE_NAME
  ,CASE WHEN member_status=0 THEN 'Active' ELSE 'Inactive' END as status
        FROM MEM_USERS AS U
		LEFT JOIN MEM_ROLE AS R ON U.role_id=R.ID`;
        if (role_id) {
            // ✅ Convert string to array safely
            const roleArray = role_id.split(',')
                .map(id => parseInt(id.trim()))
                .filter(id => !isNaN(id));

            if (roleArray.length > 0) {
                const params = roleArray.map((id, index) => {
                    const paramName = `role${index}`;
                    request.input(paramName, sql.Int, id);
                    return `@${paramName}`;
                });

                query += ` WHERE U.role_id NOT IN (${params.join(',')}) AND member_status = 0 `;
            }
        }
        query += ` ORDER BY U.role_id ASC`;
        const result = await request.query(query);        
        
        return buildResponse(200,{data: result.recordset},event);
    } catch (err) {
        console.error('Database connection error:', err);
        
        return buildResponse(500,{ message: "Internal server error" },event);
    }
};
