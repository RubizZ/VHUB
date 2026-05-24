import { S3Client } from "@aws-sdk/client-s3";

// Ensure environment variables are loaded
const S3_ENDPOINT = process.env.S3_ENDPOINT || "http://localhost:9000";
const S3_REGION = process.env.S3_REGION || "eu-west-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "minioadmin";
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "avatars";

// Initialize S3 Client
export const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  // Use path-style addressing for MinIO compatibility (e.g. localhost:9000/bucket_name)
  forcePathStyle: true,
});

/**
 * Helper to generate public URL for a given key
 */
export function getS3PublicUrl(key: string) {
  const prefix = process.env.S3_PUBLIC_URL_PREFIX;
  if (prefix) {
    // If there's a specific public prefix configured (e.g. Supabase public URL)
    return `${prefix.replace(/\/$/, '')}/${key}`;
  }
  // Fallback for MinIO locally
  return `${S3_ENDPOINT}/${S3_BUCKET_NAME}/${key}`;
}
