const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
const bcrypt = require('bcryptjs');

// Matches the policy the frontend's own password field displays as a hint
// (adduser-dialog.html: "at least 15 characters long and include uppercase,
// lowercase, number, and special character") -- the frontend's actual
// Angular validator only enforces Validators.minLength(6), which doesn't
// match its own hint. Enforcing the real policy here.
const PASSWORD_POLICY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{15,}$/;
const ADMIN_ROLE_ID = 7;
// var conn = require('/opt/config.json');
// const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const config = {
//   user: conn.dbuser,
//   password: conn.dbpassword,
//   server: conn.dbhost,
//   database: conn.dbname,
//   port: 1433,
//   options: {
//     encrypt: true,
//     trustServerCertificate: true
//   }
// };

// let poolPromise;
// async function getDBConnection() {
//   if (!poolPromise) {
//     poolPromise = sql.connect(config);
//   }
//   return poolPromise;
// }

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  // Authorization: ID comes from the request body, so the caller (verified
  // Cognito sub -> MEM_USERS) must be that same user or an Admin -- otherwise
  // any authenticated caller could reset anyone's password.

  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { message: "Unauthorized" }, event);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return buildResponse(400, { message: "Invalid JSON body" }, event);
  }
  const {
    ID,
    Password
  } = body;

  if (!ID || !/^\d+$/.test(String(ID))) {
    return buildResponse(400, { message: "ID is required" }, event);
  }

  if (!Password || Password.trim() === '') {
    return buildResponse(400, { message: "Password is required" }, event);
  }

  // Enforce a real password policy server-side -- the Angular form's own
  // validation is not a substitute, since this endpoint can be called
  // directly.
  if (!PASSWORD_POLICY_RE.test(Password)) {
    return buildResponse(400, { message: "Password must be at least 15 characters and include uppercase, lowercase, a number, and a special character" }, event);
  }

  let pool;

  try {
    pool = await getDBConnection();

    // Only the account owner (change-password page) or an Admin may set a
    // user's password.
    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(403, { message: "Forbidden" }, event);
    }
    if (Number(caller.role_id) !== ADMIN_ROLE_ID && Number(caller.ID) !== Number(ID)) {
      return buildResponse(403, { message: "Forbidden" }, event);
    }

    const request = pool.request();

    // password_last_changed is set from the server's own clock (GETDATE())
    // rather than trusted from the client, so it can't be backdated/spoofed.
    request.input('ID', sql.Int, ID);

    let query = `
      UPDATE MEM_USERS SET
        password_last_changed = GETDATE()
    `;

    // 🔥 Only update password if provided
    if (Password && Password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(Password, 10);
      request.input('Password', sql.VarChar, hashedPassword);
      query += `, Password = @Password`;
    }

    query += ` WHERE ID = @ID`;

    const result = await request.query(query);

    // return {
    //   statusCode: 200,
    //   data: result.recordset
    // };
    return buildResponse(200,{ data: result.recordset },event);
  } catch (err) {
    console.error('Database error:', err);
    // return {
    //   statusCode: 500,
    //   data: JSON.stringify({ error: err.message })
    // };

    return buildResponse(500,{ error: "Internal Server Error" },event);
  }  
};
