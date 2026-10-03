const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');

// Finding 3.1.7: this endpoint SELECTed U.Password (a bcrypt hash) and
// returned it to any caller -- combined with the lack of an auth check below,
// any authenticated user could harvest every user's password hash. USERS
// LIST is an Admin-only page, so gate it and drop Password from the query.
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  let pool;
  try {
    if (event.httpMethod === 'OPTIONS') {
      return buildResponse(200, {}, event);
    }

    const claims = event.requestContext?.authorizer?.claims || {};
    const callerSub = claims.sub;
    if (!callerSub) {
      return buildResponse(401, { message: 'Unauthorized' }, event);
    }

    pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
      return buildResponse(403, { message: 'Forbidden' }, event);
    }

    // Define SQL queries
    const queries = {
      users: ` SELECT  U.[ID],U.cognito_username,[initial],[FistName],[LastName],[EmailID],[member_role],U.department_id  ,member_status,role_id,R.ROLE_NAME,D.department  ,CASE WHEN member_status=0 THEN 'Active' ELSE 'In-active' END as status,ULA.LOCKED
            FROM MEM_USERS AS U
            LEFT JOIN MEM_ROLE AS R ON U.role_id=R.ID
            LEFT JOIN MEM_DEPARTMENT AS D ON U.department_id=D.id
            LEFT JOIN USER_LOGIN_ATTEMPTS AS ULA ON U.EmailID=ULA.USERNAME
            ORDER BY U.[FistName] ASC `,
      roles: ` SELECT [ID]
                ,[ROLE_NAME]
                ,[SHORT_ORDER]
                ,[STATUS]
                ,[NEW_STATUS]
            FROM [MEM_ROLE]
            WHERE [NEW_STATUS] ='0' `,
      department: ` SELECT [id]
                ,[department]
                ,[status]
            FROM [MEM_DEPARTMENT]
            WHERE [status]='0' `,
    };
    // Run queries in parallel

    const [users, roles, department] = await Promise.all([
      pool.request().query(queries.users),
      pool.request().query(queries.roles),
      pool.request().query(queries.department),
    ]);

    // return {
    //     statusCode: 200,
    //     data: {
    //         users: users.recordset,
    //         roles: roles.recordset,
    //         department: department.recordset
    //     }
    // };
    return buildResponse(
      200,
      {
        data: {
          users: users.recordset,
          roles: roles.recordset,
          department: department.recordset,
        },
      },
      event
    );
  } catch (err) {
    console.error('Database connection error:', err);
    // return {
    //     statusCode: 500,
    //     data: JSON.stringify({ error: "Internal Server Error", details: err.message }),
    // };
    return buildResponse(
      500,
      { error: '', message: 'Internal server error' },
      event
    );
  }
};
