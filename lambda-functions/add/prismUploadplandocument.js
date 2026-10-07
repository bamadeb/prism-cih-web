const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getDBConnection, sql } = require('/opt/dbConfig');
const { buildResponse } = require('/opt/responseHelper');

const REGION = "us-east-1";

// No explicit credentials here -- the SDK's default provider chain picks up
// this Lambda's own execution role automatically. Make sure the execution role
// is granted s3:PutObject scoped to ALLOWED_BUCKET below (and nothing broader).
// requestChecksumCalculation: "WHEN_REQUIRED" stops the SDK from embedding an
// x-amz-checksum-crc32 param in the presigned URL (computed against an empty
// body), which made browser PUTs fail with 403.
const s3 = new S3Client({ region: REGION, requestChecksumCalculation: "WHEN_REQUIRED" });

const ADMIN_ROLE_ID = 7;

// Only these attachment types are accepted; each maps to a record type the
// frontend opens the attachments dialog for ('plan' from the plans screen,
// 'user' from the user-creation-request screen).
const ALLOWED_DIRECTORIES = new Set(["plan", "user"]);
const ALLOWED_ENVS = new Set(["dev", "prod"]);

// The bucket must never come from the client.
const ALLOWED_BUCKET = process.env.PLAN_DOCUMENT_BUCKET || "cih-plan-document";

// Block path separators, control characters and ".." traversal; allow ordinary
// filenames with spaces, parentheses, apostrophes, etc.
const SAFE_FILENAME_RE = /^[^\/\\\x00-\x1f]{1,200}$/;
function isSafeFileName(name) {
  return typeof name === "string" && SAFE_FILENAME_RE.test(name) && !name.includes("..");
}

exports.handler = async (event) => {
  if (event?.httpMethod === "OPTIONS") {
    return buildResponse(200, {}, event);
  }

  // Finding 3.3.5: this handler signed an upload URL for any directory and id
  // the caller sent, so any logged-in user could write into another record's
  // folder. Now the caller must be a known app user, and 'user' attachments
  // additionally require Admin.
  const claims = event?.requestContext?.authorizer?.claims || {};
  const callerSub = claims.sub;
  if (!callerSub) {
    return buildResponse(401, { error: "Unauthorized" }, event);
  }

  let payload;
  try {
    payload = event?.body ? JSON.parse(event.body) : (event || {});
  } catch {
    return buildResponse(400, { error: "Invalid JSON body" }, event);
  }
  const { fileName, fileType, directory, id, env } = payload;

  if (!isSafeFileName(fileName)) {
    return buildResponse(400, { error: "Invalid fileName" }, event);
  }
  if (!ALLOWED_DIRECTORIES.has(directory) || !ALLOWED_ENVS.has(env) || !/^\d+$/.test(String(id))) {
    return buildResponse(400, { error: "Invalid directory, id or env" }, event);
  }

  try {
    const pool = await getDBConnection();
    const callerLookup = await pool.request()
      .input('cognito_username', sql.VarChar, callerSub)
      .query('SELECT ID, role_id FROM MEM_USERS WHERE cognito_username = @cognito_username');
    const caller = callerLookup.recordset[0];
    if (!caller) {
      return buildResponse(403, { error: "Forbidden" }, event);
    }
    if (directory === "user" && Number(caller.role_id) !== ADMIN_ROLE_ID) {
      return buildResponse(403, { error: "Forbidden" }, event);
    }

    const KEY = `${env}/${directory}/${id}/${Date.now()}-${fileName}`;
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: ALLOWED_BUCKET, Key: KEY, ContentType: fileType }),
      { expiresIn: 300 }
    );
    const fileUrl = `https://${ALLOWED_BUCKET}.s3.${REGION}.amazonaws.com/${KEY}`;

    return buildResponse(200, { uploadUrl, fileUrl }, event);

  } catch (err) {
    console.error("S3 presign / authorization error:", err);
    return buildResponse(500, { error: "Internal server error" }, event);
  }
};