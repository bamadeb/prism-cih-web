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
  // TODO(authorization): ID is taken directly from the request body with no
  // check that the caller owns that ID (self-service password change) or is
  // an admin performing this on someone's behalf. As written, any
  // authenticated caller can pass any other user's ID and reset their
  // password. Wire in a check here once the auth-claims shape reaching this
  // Lambda is confirmed (e.g. event.requestContext.authorizer.claims).

  const body = JSON.parse(event.body || "{}");
  const {
    ID,
    Password
  } = body;

  if (!ID) {
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
