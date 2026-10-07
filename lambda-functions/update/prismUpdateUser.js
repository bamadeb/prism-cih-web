const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
const bcrypt = require('bcryptjs');

// Matches the policy the frontend's own password field displays as a hint
// (adduser-dialog.html: "at least 15 characters long and include uppercase,
// lowercase, number, and special character") -- the frontend's actual
// Angular validator only enforces Validators.minLength(6), which doesn't
// match its own hint. Same policy enforced in prismUpdateCognitoUser.js,
// which the frontend calls right before this endpoint with the same
// password -- keeping both in sync so one can't silently accept a weaker
// password than the other.
const PASSWORD_POLICY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{15,}$/;

// STATUS select in adduser-dialog.html only offers these two values.
const VALID_MEMBER_STATUS = new Set([0, 1]);
// const sql = require('mssql');
// const bcrypt = require('bcryptjs');
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

// The MANAGE USERS page this endpoint backs is Admin-only by design (confirmed
// via prismGetPageAccessList-prod: only role_id 7 has a "MANAGE USERS" row) --
// there is no legitimate self-service profile-edit path through this endpoint.
// A security review confirmed a Navigator could send {"ID": <own_id>,
// "role_id": 7} and self-escalate to Admin, and separately modify an
// unrelated user's role/department/status by supplying a different ID
// (CWE-915 mass assignment + broken object-level authorization).
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  // API Gateway has a Cognito User Pool authorizer (confirmed: "CognitoProd")
  // in front of this route, so the caller's verified ID token claims arrive
  // here in event.requestContext.authorizer.claims -- `sub` is the Cognito
  // user's UUID, which is stored in MEM_USERS.cognito_username.
  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { message: "Unauthorized" }, event);
  }

  const body = JSON.parse(event.body || "{}");
  const {
    FistName,
    LastName,
    ID,
    role_id,
    department_id,
    member_status,
    Password
  } = body;

  // role, department and status are all required on the frontend's edit form
  // (Validators.required on 'role'/'department'/'status') -- match that here.
  // member_status uses the same explicit presence check as role_id/department_id
  // rather than `!member_status`, since 0 (ACTIVE) is a valid value and must
  // not be rejected as "missing".
  if (!ID || !FistName || !LastName
      || role_id === undefined || role_id === null || role_id === ''
      || department_id === undefined || department_id === null || department_id === ''
      || member_status === undefined || member_status === null || member_status === '') {
    return buildResponse(400, { message: "ID, FistName, LastName, role_id, department_id and member_status are required" }, event);
  }

  if (!Number.isInteger(Number(role_id)) || !Number.isInteger(Number(department_id))) {
    return buildResponse(400, { message: "Invalid role_id or department_id" }, event);
  }

  // STATUS select only offers ACTIVE (0) / IN-ACTIVE (1) -- reject anything
  // else rather than writing an arbitrary integer.
  if (!VALID_MEMBER_STATUS.has(Number(member_status))) {
    return buildResponse(400, { message: "Invalid member_status" }, event);
  }

  // Password is optional here (edit mode leaves it blank to keep the
  // current password), but if the caller sent one it must meet the same
  // policy as prismUpdateCognitoUser.js, which the frontend calls with this
  // same value right before this endpoint.
  if (Password && Password.trim() !== '' && !PASSWORD_POLICY_RE.test(Password)) {
    return buildResponse(400, { message: "Password must be at least 15 characters and include uppercase, lowercase, a number, and a special character" }, event);
  }

  let pool;

  try {
    pool = await getDBConnection();

    // Look up the caller's own role by their verified Cognito sub -- never
    // trust a role/id claimed in the request body itself.
    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');

    const caller = callerLookup.recordset[0];
    if (!caller || Number(caller.role_id) !== ADMIN_ROLE_ID) {
      return buildResponse(403, { message: "Forbidden" }, event);
    }

    const request = pool.request();

    request.input('FistName', sql.VarChar, FistName);
    request.input('LastName', sql.VarChar, LastName);
    request.input('role_id', sql.Int, role_id);
    request.input('department_id', sql.Int, department_id);
    request.input('member_status', sql.Int, member_status);
    request.input('ID', sql.Int, ID);

    let query = `
      UPDATE MEM_USERS SET 
        FistName = @FistName,
        LastName = @LastName,
        role_id = @role_id,
        department_id = @department_id,
        member_status = @member_status
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
