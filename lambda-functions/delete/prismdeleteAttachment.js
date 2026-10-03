const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse, handleOptions } = require('/opt/responseHelper');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// MEM_ATTACHMENT.attachment stores the full S3 URL produced by
// prismUploadplandocument.js (https://cih-plan-document.s3.us-east-1.
// amazonaws.com/<key>) -- confirmed via fileattach-dialog.ts's
// insertFiletoDB/updateFileUrlToDB, which write `fileUrl` straight into that
// column. This handler previously only deleted the DB row, leaving the
// actual file behind in S3 forever (orphaned storage, confirmed via
// production report). Same bucket/region as prismUploadplandocument.js.
const REGION = 'us-east-1';
const ALLOWED_BUCKET = process.env.PLAN_DOCUMENT_BUCKET || 'cih-plan-document';
const s3 = new S3Client({ region: REGION });

function keyFromAttachmentUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));
  } catch {
    return null;
  }
}
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

    // Fetch the attachment's URL before deleting the row -- it won't be
    // queryable afterward.
    const lookup = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT attachment FROM MEM_ATTACHMENT WHERE id = @id');

    const attachmentUrl = lookup.recordset[0]?.attachment;
    const key = attachmentUrl ? keyFromAttachmentUrl(attachmentUrl) : null;

    if (key) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: ALLOWED_BUCKET, Key: key }));
      } catch (s3Err) {
        // Don't let an S3 hiccup block removing the DB record -- log it
        // server-side for manual cleanup rather than failing the user-facing
        // delete action over a storage-layer issue.
        console.error('S3 delete error (continuing with DB delete):', s3Err);
      }
    }

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
