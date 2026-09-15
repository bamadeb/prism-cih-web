
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
const bcrypt = require('bcryptjs');
// const sql = require('mssql');
// const bcrypt = require('bcryptjs');
// var conn = require('/opt/config.json')
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Matches the policy the frontend's own password field displays as a hint
// (adduser-dialog.html: "at least 15 characters long and include uppercase,
// lowercase, number, and special character") -- the frontend's actual
// Angular validator only enforces Validators.minLength(6), which doesn't
// match its own hint. Same policy enforced in prismCreateCognitoUser.js,
// which the frontend calls with this same password right before this
// endpoint -- keeping both in sync.
const PASSWORD_POLICY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{15,}$/;

// STATUS select in adduser-dialog.html only offers these two values.
const VALID_MEMBER_STATUS = new Set([0, 1]);

exports.handler = async (event) => {
    // TODO(authorization): this creates a real user account and currently
    // has no check that the caller is an admin. Wire in a role check here
    // once the auth-claims shape reaching this Lambda is confirmed (e.g.
    // event.requestContext.authorizer.claims).

    if (event.httpMethod === "OPTIONS") {
        return buildResponse(200,{},event);
    }
    const body = JSON.parse(event.body || "{}");
    // Trimmed server-side too -- the frontend already trims firstName/lastName
    // before sending, but a direct call bypassing the UI wouldn't, and a
    // whitespace-only value (e.g. "   ") passes a plain truthy check.
    var FistName = typeof body.FistName === 'string' ? body.FistName.trim() : body.FistName;
    var LastName = typeof body.LastName === 'string' ? body.LastName.trim() : body.LastName;
    var EmailID = typeof body.EmailID === 'string' ? body.EmailID.trim() : body.EmailID;
    var role_id = body.role_id;
    var department_id = body.department_id;
    var member_status = body.member_status;
    var cognito_username = typeof body.cognito_username === 'string' ? body.cognito_username.trim() : body.cognito_username;

    try {
        // ✅ Input validation
        if (!FistName || !LastName || !EmailID || !body.Password) {

            return buildResponse(400,{data: 'Missing required fields'},event);
        }

        // cognito_username isn't user-typed -- it's the value returned by the
        // prismCreateCognitoUser call the frontend makes right before this one.
        // Without it, this row would have no link back to its Cognito account,
        // breaking login and any future updateCognitoUser call for this user.
        if (!cognito_username) {
            return buildResponse(400,{ data: 'cognito_username is required' },event);
        }

        // Match the DB column sizes below (VarChar(100)/(150)) so an
        // oversized value fails cleanly here instead of surfacing as a raw
        // SQL truncation error.
        if (FistName.length > 100 || LastName.length > 100) {
            return buildResponse(400,{ data: 'FistName/LastName must be 100 characters or fewer' },event);
        }
        if (EmailID.length > 150 || cognito_username.length > 150) {
            return buildResponse(400,{ data: 'EmailID/cognito_username must be 150 characters or fewer' },event);
        }

        if (!EMAIL_RE.test(EmailID)) {
            return buildResponse(400,{ data: 'Invalid email address' },event);
        }

        if (!Number.isInteger(Number(role_id)) || !Number.isInteger(Number(department_id))) {
            return buildResponse(400,{ data: 'Invalid role_id or department_id' },event);
        }

        if (!VALID_MEMBER_STATUS.has(Number(member_status))) {
            return buildResponse(400,{ data: 'Invalid member_status' },event);
        }

        if (!PASSWORD_POLICY_RE.test(body.Password)) {
            return buildResponse(400,{ data: 'Password must be at least 15 characters and include uppercase, lowercase, a number, and a special character' },event);
        }

        // ✅ Hash password safely
        const hashedPassword = await bcrypt.hash(body.Password, 10);

        const pool = await getDBConnection();
        const request = pool.request();

        // ✅ Parameterized query (SQL Injection SAFE)
        request.input('FistName', sql.VarChar(100), FistName);
        request.input('LastName', sql.VarChar(100), LastName);
        request.input('EmailID', sql.VarChar(150), EmailID);
        request.input('Password', sql.VarChar(255), hashedPassword);
        request.input('role_id', sql.Int, role_id);
        request.input('member_status', sql.Int, member_status);
        request.input('department_id', sql.Int, department_id);
        request.input('cognito_username', sql.VarChar(150), cognito_username);

        const result = await request.query(`
            INSERT INTO MEM_USERS 
            ([FistName],[LastName],[EmailID],[Password],[role_id],[member_status],[department_id],[cognito_username])
            VALUES 
            (@FistName,@LastName,@EmailID,@Password,@role_id,@member_status,@department_id,@cognito_username)
        `);

        
        return buildResponse(200,{message: 'User created successfully'},event);
    } catch (err) {
        console.error('Database connection error:', err);
        // SQL Server unique-constraint violation (2627/2601) -- the frontend's
        // separate checkuserexist call isn't atomic with this insert, so a
        // race (or a direct call bypassing the UI) can still hit a duplicate
        // EmailID. Surface a clean message instead of a generic 500.
        if (err && (err.number === 2627 || err.number === 2601)) {
            return buildResponse(409,{ message: "A user with this email already exists" },event);
        }
        return buildResponse(500,{ message: "Internal server error" },event);
    }
};