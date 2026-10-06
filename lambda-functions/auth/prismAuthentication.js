const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
const bcrypt = require('bcryptjs');

// Fixed, never-matching bcrypt hash used solely to normalize response timing
// for nonexistent usernames (Finding 3.4.9) -- not a real user's password hash.
const DUMMY_BCRYPT_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8G/IP/NMnCPGnZAnuY/Grlf6jKkpiMK';

// const sql = require('mssql');
// const conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const bcrypt = require('bcryptjs'); // ✅ use bcryptjs

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
//     max: 10,
//     min: 1,
//     idleTimeoutMillis: 300000,
//     acquireTimeoutMillis: 10000
//   }
// };

// let connectionPool;

// async function getDBConnection() {
//   if (!connectionPool || !connectionPool.connected) {
//     connectionPool = await sql.connect(config);
//   }
//   return connectionPool;
// }

exports.handler = async (event) => {
  // const allowedOrigins = [
  //   "http://dev-impactsystem.collectiveimpacthealth.com/" // 🔁 change this
  // ];

  // const origin = event.headers?.origin || "";
  // const isAllowed = allowedOrigins.includes(origin);

  // const commonHeaders = {
  //   "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    
  //   "Access-Control-Allow-Credentials": "true",
  //   "Access-Control-Allow-Headers": "Content-Type, Authorization",
  //   "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  //   "Vary": "Origin",
  //   ...(isAllowed && { "Access-Control-Allow-Origin": origin })
  // };  
  try {
    // ✅ Handle preflight request
    if (event.httpMethod === "OPTIONS") {
      return buildResponse(200,{},event);    
    }

    // ✅ Parse body safely
    const body = JSON.parse(event.body || "{}");
    const username = body.username;
    const password = body.password;

    if (!username || !password) {
      return buildResponse(400,{ error: "Username and password are required" },event);
      
      
    }

    const pool = await getDBConnection();
    const request = pool.request();
    request.input('username', sql.VarChar, username);

    // ❌ DO NOT check password in SQL
    const query = `
      WITH Policy AS (
    SELECT
        MAX(CASE WHEN variable_name = 'password_expiry_days'
                 THEN variable_value END) AS password_expiry_days,
        MAX(CASE WHEN variable_name = 'warning_start_days'
                 THEN variable_value END) AS warning_start_days,
        MAX(CASE WHEN variable_name = 'warning_end_days'
                 THEN variable_value END) AS warning_end_days
    FROM SYSTEM_VARIABLES
)
SELECT 
    U.[ID], U.Password, U.company_id, U.role_id, U.initial, U.department_id,
    U.parent_id, U.title, U.FistName, U.LastName, U.EmailID,
    U.Phone, U.member_role, U.action_type, U.language, U.add_date,
    U.member_status, U.ward, U.zipcode, U.race, U.max_load,
    U.department, U.patientID, [plan], U.profile_image,
    U.medicaid_id, U.image,
    R.ROLE_NAME,
    C.company_logo, C.company_name, C.inner_logo,
    U.cognito_username,

    /* Password age */
    CASE 
        WHEN U.password_last_changed IS NULL THEN 999
        ELSE DATEDIFF(DAY, U.password_last_changed, GETDATE())
    END AS password_age_days,

    /* Warning flag */
    CASE
        WHEN U.password_last_changed IS NULL THEN 0
        WHEN DATEDIFF(DAY, U.password_last_changed, GETDATE())
             BETWEEN P.warning_start_days AND P.warning_end_days
        THEN 1
        ELSE 0
    END AS password_expiry_warning,

    /* Expired flag */
    CASE 
        WHEN U.password_last_changed IS NULL THEN 1
        WHEN DATEDIFF(DAY, U.password_last_changed, GETDATE())
             >= P.password_expiry_days
        THEN 1
        ELSE 0
    END AS is_password_expired,

    /* Password message */
    CASE
        WHEN U.password_last_changed IS NULL
            THEN 'Your password has expired. Please reset your password.'
        WHEN DATEDIFF(DAY, U.password_last_changed, GETDATE())
             >= P.password_expiry_days
            THEN 'Your password has expired. Please reset your password.'
        WHEN DATEDIFF(DAY, U.password_last_changed, GETDATE())
             BETWEEN P.warning_start_days AND P.warning_end_days
            THEN CONCAT(
                'Your password will expire in ',
                (P.password_expiry_days -
                 DATEDIFF(DAY, U.password_last_changed, GETDATE())),
                ' day(s). Please update it soon.'
            )
        ELSE ''
    END AS password_message

FROM MEM_USERS U
CROSS JOIN Policy P
LEFT JOIN MEM_ROLE R ON U.role_id = R.ID
LEFT JOIN MEM_COMPANY C ON U.company_id = C.id
WHERE U.EmailID = @username
  AND U.member_status = '0'
    `;

    const query1 = `SELECT a.[role_id],p.page_name    
        FROM ROLE_PAGE_ACCESS as a
        JOIN MST_PAGES as p ON a.page_id=p.id
        WHERE a.[status] = 0`;

    const result = await request.query(query);
    const res = await request.query(query1);

    // Finding 3.4.9: a nonexistent username used to short-circuit here before
    // ever calling bcrypt.compare(), while a valid username always paid the
    // ~80-100ms bcrypt cost below. That timing gap let an attacker tell
    // "wrong password" apart from "no such user" by latency alone, even
    // though both return the same empty 401. Comparing against a fixed dummy
    // hash here keeps the timing the same on both paths.
    if (result.recordset.length === 0) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return buildResponse(401,{},event);
    }

    const user = result.recordset[0];

    // Finding 3.2.5: password was checked with no lockout enforcement, so a
    // locked account (per USER_LOGIN_ATTEMPTS.LOCKED, set/reset elsewhere)
    // could still be brute-forced through this endpoint.
    const lockCheck = await request.query(
      `SELECT LOCKED FROM USER_LOGIN_ATTEMPTS WHERE USERNAME = @username`
    );
    const lockRow = lockCheck.recordset[0];
    if (lockRow && Number(lockRow.LOCKED) === 1) {
      return buildResponse(423, { error: 'Account is locked. Contact an administrator.' }, event);
    }

    // ✅ Compare password with bcrypt
    const isMatch = await bcrypt.compare(password, user.Password);

    if (!isMatch) {
      //return { statusCode: 401, headers: commonHeaders, data: [] };
      return buildResponse(401,{},event);
    }

    // ❌ Never send password back
    delete user.Password;

    // return {
    //   statusCode: 200,
    //   headers: commonHeaders,
    //   data: [user],
    //   pageAccess:res.recordset
    // };
    return buildResponse(200,{data: [user], pageAccess:res.recordset},event);
  } catch (err) {
    console.error('Database error:', err);
    return buildResponse(500,{ error: 'Internal Server Error.' },event);
  }
};
