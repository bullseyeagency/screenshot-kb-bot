import sharp from 'sharp'

export interface CompressResult {
  buffer: Buffer
  contentType: 'image/jpeg' | 'image/webp'
  width: number
  height: number
  sizeBytes: number
}

/**
 * Compress an image buffer using sharp.
 * - Resizes to max 1920px on longest edge (preserves aspect ratio)
 * - Converts to JPEG at quality 82
 * - Strips EXIF metadata
 */
export async function compressImage(input: Buffer): Promise<CompressResult> {
  const pipeline = sharp(input)
    .rotate() // auto-rotate based on EXIF
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })

  const buffer = await pipeline.toBuffer()
  const meta = await sharp(buffer).metadata()

  return {
    buffer,
    contentType: 'image/jpeg',
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    sizeBytes: buffer.length,
  }
}
