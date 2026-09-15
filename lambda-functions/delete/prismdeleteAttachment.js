const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
// const sql = require('mssql');
// const conn = require('/opt/config.json');
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

// /**
//  * Reuse DB connection across Lambda invocations
//  */
// async function getDBConnection() {
//   if (!poolPromise) {
//     poolPromise = sql.connect(config);
//   }
//   return poolPromise;
// }

exports.handler = async (event) => {
  // TODO(authorization): id is a plain, likely-sequential integer with no
  // check that this attachment belongs to a plan/record the caller has
  // access to -- any authenticated caller can delete any attachment by
  // guessing/enumerating ids. Wire in an ownership check here once the
  // auth-claims shape reaching this Lambda is confirmed (e.g.
  // event.requestContext.authorizer.claims).

  //const id = event.id;
  const body = JSON.parse(event.body || "{}");
  const id = body.id;

  if (!id || !Number.isInteger(Number(id))) {
    // return {
    //   statusCode: 400,
    //   data: JSON.stringify({ message: 'id is required' })
    // };
    return buildResponse(400,{ message: 'id is required' },event);
  }

  try {
    const pool = await getDBConnection();

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM MEM_ATTACHMENT
        WHERE id = @id
      `);

    // return {
    //   statusCode: 200,
    //   data: JSON.stringify({
    //     success: true,
    //     rowsAffected: result.rowsAffected[0]
    //   })
    // };
    return buildResponse(200,{ success: true,rowsAffected: result.rowsAffected[0] },event);

  } catch (err) {
    console.error('Delete error:', err);

    // return {
    //   statusCode: 500,
    //   data: JSON.stringify({
    //     message: 'Database delete failed',
    //     error: err.message
    //   })
    // };
    return buildResponse(500,{ message: 'Database delete failed',error: 'Internal Server Error.' },event);
  }
};
