import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME || 'po-checkin-photos'
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

export function generateR2Key(poNumber: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const timestamp = now.getTime()
  const uuid = crypto.randomUUID().split('-')[0]
  const safePo = poNumber.replace(/[^a-zA-Z0-9-_]/g, '_')
  return `submissions/${year}/${month}/${safePo}/${timestamp}-${uuid}.jpg`
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string = 'image/jpeg'
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
  return `${R2_PUBLIC_URL}/${key}`
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  )
}
