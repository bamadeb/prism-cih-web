const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json');

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

// /**
//  * Reusable DB connection (Lambda safe)
//  */
// async function getDBConnection() {
//   if (!poolPromise) {
//     poolPromise = sql.connect(config);
//   }
//   return poolPromise;
// }

// Attachment owners the app uses (same values prismUploadplandocument.js
// allows as directories). 'user' = user-creation requests: Admin only, same
// rule as prismdeleteAttachment.js.
const ALLOWED_TYPES = new Set(['plan', 'user']);
const ADMIN_ROLE_ID = 7;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  //event.type = 'plan';
  //event.type_id = '3';
  // const type = event.type;
  // const type_id = event.type_id;
  const claims = event.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { message: 'Unauthorized' }, event);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return buildResponse(400, { message: 'Invalid JSON body' }, event);
  }
  const type = body.type;        // e.g. "plan"
  const type_id = body.type_id;  // e.g. 3

  if (!type || !type_id || !Number.isInteger(Number(type_id))) {
    // return {
    //   statusCode: 400,
    //   data: JSON.stringify({ message: 'type and type_id are required' })
    // };
    return buildResponse(400, { message: 'type and type_id are required' }, event);
  }
  if (!ALLOWED_TYPES.has(type)) {
    return buildResponse(400, { message: 'Invalid type' }, event);
  }

  try {
    const pool = await getDBConnection();

    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller || (type === 'user' && Number(caller.role_id) !== ADMIN_ROLE_ID)) {
      return buildResponse(403, { message: 'Forbidden' }, event);
    }

    const result = await pool
      .request()
      .input('type', sql.VarChar, type)
      .input('type_id', sql.Int, type_id)
      .query(`
        SELECT
          id,
          type,
          type_id,
          attachment,
          title,
          note,
          add_date,
          added_by,
          status
        FROM MEM_ATTACHMENT
        WHERE type = @type
          AND type_id = @type_id
        ORDER BY id ASC
      `);

    // return {
    //   statusCode: 200,
    //   data: result.recordset
    // };
    return buildResponse(200, { data: result.recordset }, event);

  } catch (err) {
    console.error('Database error:', err);

    // return {
    //   statusCode: 500,
    //   data: JSON.stringify({
    //     message: 'Database error',
    //     error: err.message
    //   })
    // };
    return buildResponse(500, { message: 'Database error', error: 'Internal Server Error' }, event);
  }
};
