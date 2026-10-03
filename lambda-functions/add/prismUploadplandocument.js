const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const REGION = "us-east-1";

// No explicit credentials here -- the SDK's default provider chain picks up
// this Lambda's own execution role automatically. The previous version had a
// long-lived IAM access key + secret hardcoded directly in source (the same
// access key ID a security review already found disclosed in every API
// response via X-Amz-Credential) -- that's both a bigger blast radius if
// leaked (a static key works from anywhere, forever, vs. a role scoped to
// this function) and now a plaintext secret sitting in the repo. That key
// must be rotated/deactivated in IAM independent of this fix. Make sure the
// Lambda's execution role itself is granted s3:PutObject scoped to
// ALLOWED_BUCKET below (and nothing broader).
// requestChecksumCalculation: "WHEN_REQUIRED" opts out of the SDK's default
// "flexible checksums" behavior (on by default in recent @aws-sdk/client-s3
// releases), which otherwise embeds an x-amz-checksum-crc32 param in every
// presigned PutObject URL -- computed against an EMPTY body, since the real
// file isn't available at sign time. A plain browser fetch() PUT doesn't send
// a matching x-amz-checksum-crc32 request header, so S3's checksum validation
// fails and it returns 403 Forbidden on every upload, confirmed via a live
// production report (403 on the actual S3 PUT, not on this Lambda's own
// response). This restores the pre-flexible-checksums behavior where no
// checksum is added unless explicitly requested via ChecksumAlgorithm.
const s3 = new S3Client({ region: REGION, requestChecksumCalculation: "WHEN_REQUIRED" });

// Origins allowed to call this endpoint and receive the signed URL back.
// Access-Control-Allow-Origin must be a single exact origin (or "*"), never a
// list -- so the actual request's Origin is reflected only if it's on this
// allow-list, not sent as an array.
const ALLOWED_ORIGINS = new Set([
  "https://impactsystem.collectiveimpacthealth.com",
  "http://dev-impactsystem.collectiveimpacthealth.com",
  "http://localhost:4200"
]);

// The bucket must never come from the client -- a security review confirmed
// the previous `const BUCKET = event.bucket` let any authenticated caller get
// a validly-signed PUT URL for an ARBITRARY bucket name, signed with this
// app's own IAM credentials. Hardcoded to the one legitimate bucket (visible
// as a commented-out literal in the prior version of this file).
const ALLOWED_BUCKET = process.env.PLAN_DOCUMENT_BUCKET || "cih-plan-document";

// fileName must not contain path separators or ".." -- a security review
// confirmed "../../sensitive/data.txt" passed through unsanitized into the
// signed object key (path traversal). Also cap length.
//
// Fixed after a production report: the first version of this regex
// (^[A-Za-z0-9._-]{1,200}$) only allowed letters/digits/dot/underscore/hyphen
// and rejected ordinary filenames with spaces (e.g. "Prism user locked
// screenshot.docx"). Real filenames routinely contain spaces, parentheses,
// apostrophes, commas, etc. -- only block what's actually dangerous: path
// separators, control characters (including null bytes), and ".." traversal.
const SAFE_FILENAME_RE = /^[^\/\\\x00-\x1f]{1,200}$/;
function isSafeFileName(name) {
  return typeof name === "string" && SAFE_FILENAME_RE.test(name) && !name.includes("..");
}

exports.handler = async (event) => {
  // TODO(authorization): this handler reads fields directly off `event`
  // (event.bucket, event.fileName, ...) rather than JSON.parse(event.body)
  // like every other Lambda in this project -- meaning this API Gateway route
  // likely uses a non-proxy ("Lambda") integration with its own request
  // mapping template, not the Lambda-proxy integration the others use. That
  // means event.requestContext.authorizer.claims (the pattern now used in
  // prismUpdateUser.js / prismGetcallhistory.js) may NOT be populated the
  // same way here even if the Cognito authorizer is attached to this route --
  // check the route's Integration Request mapping template in API Gateway to
  // see whether/how it forwards the authorizer's claims (e.g. as
  // event.callerSub or similar), then verify the caller is allowed to upload
  // for the given `id` (owns/can-edit that plan) before signing anything.

  const { fileName, fileType, directory, id, env } = event || {};

  if (!isSafeFileName(fileName)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid fileName" })
    };
  }

  if (!directory || !id || !env) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "directory, id and env are required" })
    };
  }

  const timestamp = Date.now();
  const KEY = `${env}/${directory}/${id}/${timestamp}-${fileName}`;

  try {
    const params = {
      Bucket: ALLOWED_BUCKET,
      Key: KEY,
      ContentType: fileType
    };

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand(params),
      { expiresIn: 300 }
    );

    const fileUrl = `https://${ALLOWED_BUCKET}.s3.${REGION}.amazonaws.com/${KEY}`;

    // Restrict to real app origins instead of a wildcard -- a security review
    // flagged the CORS wildcard separately (finding 3.2.2) as letting any
    // third-party page trigger authenticated calls cross-origin with full
    // response readback. Reflect the caller's own Origin only if it's on the
    // allow-list (and only ever as a single value, never the whole list).
    const requestOrigin = event?.headers?.origin || event?.headers?.Origin;
    const allowOrigin = ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : "http://localhost:4200";

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ uploadUrl, fileUrl })
    };

  } catch (err) {
    console.error("S3 presign error:", err);
    // Don't echo err.message back to the caller -- log it server-side only.
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
