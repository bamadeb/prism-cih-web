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

// replace_url must be an object URL in our own bucket, exactly as
// prismUploadplandocument.js builds it -- never an arbitrary link.
function isOwnBucketUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:'
      && u.hostname === `${ALLOWED_BUCKET}.s3.${REGION}.amazonaws.com`
      && u.pathname.length > 1;
  } catch {
    return false;
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
  if (event.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  // TODO(authorization): id is a plain, likely-sequential integer with no
  // check that this attachment belongs to a plan/record the caller has
  // access to -- any authenticated caller can delete any attachment by
  // guessing/enumerating ids. Wire in an ownership check here once the
  // auth-claims shape reaching this Lambda is confirmed (e.g.
  // event.requestContext.authorizer.claims).

  //const id = event.id;
  const body = JSON.parse(event.body || "{}");
  const id = body.id;
  // Optional: when an attachment's file is replaced in the edit dialog, the
  // new file is already uploaded to S3. Point the row at it and delete only
  // the OLD S3 object, keeping the row. The old URL is read from the DB, never
  // taken from the client, so a caller can't name an arbitrary object to delete.
  const replaceUrl = body.replace_url;

  if (!id || !Number.isInteger(Number(id))) {
    // return {
    //   statusCode: 400,
    //   data: JSON.stringify({ message: 'id is required' })
    // };
    return buildResponse(400,{ message: 'id is required' },event);
  }

  if (replaceUrl !== undefined && !isOwnBucketUrl(replaceUrl)) {
    return buildResponse(400,{ message: 'Invalid replace_url' },event);
  }

  try {
    const pool = await getDBConnection();

    if (replaceUrl !== undefined) {
      const oldLookup = await pool
        .request()
        .input('id', sql.Int, id)
        .query('SELECT attachment FROM MEM_ATTACHMENT WHERE id = @id');

      if (oldLookup.recordset.length === 0) {
        return buildResponse(404,{ message: 'Attachment not found' },event);
      }
      const oldUrl = oldLookup.recordset[0].attachment;

      // Update the row first: if this fails, the old file is still referenced
      // and must not be deleted.
      const updated = await pool
        .request()
        .input('id', sql.Int, id)
        .input('attachment', sql.VarChar, replaceUrl)
        .query('UPDATE MEM_ATTACHMENT SET attachment = @attachment WHERE id = @id');

      const oldKey = oldUrl ? keyFromAttachmentUrl(oldUrl) : null;
      const newKey = keyFromAttachmentUrl(replaceUrl);
      if (oldKey && oldKey !== newKey) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: ALLOWED_BUCKET, Key: oldKey }));
        } catch (s3Err) {
          // The row already points at the new file; an orphaned old object is
          // a storage-cleanup issue, not a reason to fail the user's update.
          console.error('S3 delete of replaced file failed (row already updated):', s3Err);
        }
      }

      return buildResponse(200,{ success: true, replaced: true, rowsAffected: updated.rowsAffected[0] },event);
    }

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
