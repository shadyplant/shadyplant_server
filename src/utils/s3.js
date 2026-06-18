const crypto = require("crypto");

const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_SERVICE = "s3";
const DEFAULT_EXPIRES_IN_SECONDS = 900;
const MAX_EXPIRES_IN_SECONDS = 60 * 60 * 24;

function awsPercentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%7E/g, "~");
}

function getAmzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function getDateStamp(amzDate) {
  return String(amzDate).slice(0, 8);
}

function hmacDigest(key, value, encoding = "hex") {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function getSigningKey(secretAccessKey, dateStamp, region) {
  const kDate = crypto
    .createHmac("sha256", `AWS4${secretAccessKey}`)
    .update(dateStamp, "utf8")
    .digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region, "utf8").digest();
  const kService = crypto.createHmac("sha256", kRegion).update(AWS_SERVICE, "utf8").digest();
  return crypto
    .createHmac("sha256", kService)
    .update("aws4_request", "utf8")
    .digest();
}

function buildCanonicalQueryString(params) {
  return [...params.entries()]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyComparison = leftKey.localeCompare(rightKey);
      if (keyComparison !== 0) {
        return keyComparison;
      }

      return String(leftValue).localeCompare(String(rightValue));
    })
    .map(([key, value]) => `${awsPercentEncode(key)}=${awsPercentEncode(value)}`)
    .join("&");
}

function buildS3KeyPath(key) {
  return String(key || "")
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => awsPercentEncode(part))
    .join("/");
}

function buildS3Host(bucketName, region) {
  return `${bucketName}.s3.${region}.amazonaws.com`;
}

function buildPublicS3Url(bucketName, region, key) {
  const host = buildS3Host(bucketName, region);
  return `https://${host}/${buildS3KeyPath(key)}`;
}

function buildPublicAssetUrl({
  bucketName,
  region,
  key,
  publicBaseUrl,
}) {
  const normalizedBaseUrl = String(publicBaseUrl || "").trim().replace(/\/+$/, "");
  if (normalizedBaseUrl) {
    return `${normalizedBaseUrl}/${buildS3KeyPath(key)}`;
  }

  return buildPublicS3Url(bucketName, region, key);
}

function createPresignedS3PutUrl({
  accessKeyId,
  bucketName,
  expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS,
  key,
  region,
  secretAccessKey,
  publicBaseUrl,
  now = new Date(),
}) {
  if (!bucketName || !region || !accessKeyId || !secretAccessKey || !key) {
    throw new Error("Missing S3 signing configuration.");
  }

  const normalizedExpiresInSeconds = Math.max(
    1,
    Math.min(MAX_EXPIRES_IN_SECONDS, Math.floor(Number(expiresInSeconds || 0)) || DEFAULT_EXPIRES_IN_SECONDS),
  );
  const amzDate = getAmzDate(now);
  const dateStamp = getDateStamp(amzDate);
  const scope = `${dateStamp}/${region}/${AWS_SERVICE}/aws4_request`;
  const host = buildS3Host(bucketName, region);
  const canonicalUri = `/${buildS3KeyPath(key)}`;
  const queryParams = new Map([
    ["X-Amz-Algorithm", AWS_ALGORITHM],
    ["X-Amz-Credential", `${accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(normalizedExpiresInSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ]);
  const canonicalQueryString = buildCanonicalQueryString(queryParams);
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    AWS_ALGORITHM,
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmacDigest(
    getSigningKey(secretAccessKey, dateStamp, region),
    stringToSign,
  );

  return {
    signedUrl: `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`,
    publicUrl: buildPublicAssetUrl({
      bucketName,
      region,
      key,
      publicBaseUrl,
    }),
    expiresInSeconds: normalizedExpiresInSeconds,
    amzDate,
    scope,
  };
}

module.exports = {
  AWS_ALGORITHM,
  buildPublicAssetUrl,
  buildPublicS3Url,
  createPresignedS3PutUrl,
};
