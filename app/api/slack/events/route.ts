import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature, downloadSlackFile, postAnalysisReply } from '@/lib/slack'
import { analyzeImage } from '@/lib/claude'
import { compressImage } from '@/lib/compress'
import { uploadToR2 } from '@/lib/r2'

// Supported image mime types
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ImageMime = (typeof IMAGE_TYPES)[number]

function isImageMime(mime: string): mime is ImageMime {
  return IMAGE_TYPES.includes(mime as ImageMime)
}

async function processImageEvent(event: Record<string, unknown>) {
  try {
    const files = event.files as Array<Record<string, unknown>> | undefined
    if (!files?.length) return

    const channel = event.channel as string
    const ts = event.ts as string

    for (const file of files) {
      const mimeType = file.mimetype as string
      if (!isImageMime(mimeType)) continue

      // Prefer url_private_download, fall back to url_private
      const url = (file.url_private_download ?? file.url_private) as string
      if (!url) continue

      const fileName = (file.name as string) ?? 'image'

      // React with hourglass to show processing
      const { slack } = await import('@/lib/slack')
      await slack.reactions.add({ channel, timestamp: ts, name: 'hourglass_flowing_sand' }).catch(() => {})

      // Download raw file from Slack
      const rawBuffer = await downloadSlackFile(url)

      // Compress before uploading to R2
      const compressed = await compressImage(rawBuffer)

      // Upload to R2
      const key = `screenshots/slack-${Date.now()}-${crypto.randomUUID()}.jpg`
      await uploadToR2(key, compressed.buffer, 'image/jpeg')

      // Analyze using the compressed buffer directly (no re-fetch needed)
      const result = await analyzeImage(compressed.buffer, 'image/jpeg')

      // Post reply in thread
      await postAnalysisReply(channel, ts, result, fileName)

      // Replace hourglass with white_check_mark
      await slack.reactions.remove({ channel, timestamp: ts, name: 'hourglass_flowing_sand' }).catch(() => {})
      await slack.reactions.add({ channel, timestamp: ts, name: 'white_check_mark' }).catch(() => {})
    }
  } catch (err) {
    console.error('Error processing image event:', err)
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()

  // Verify Slack signature
  const signingSecret = process.env.SLACK_SIGNING_SECRET ?? ''
  const signature = req.headers.get('x-slack-signature') ?? ''
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? ''

  if (!verifySlackSignature(signingSecret, signature, timestamp, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  // Handle Slack URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Handle event callbacks
  if (payload.type === 'event_callback') {
    const event = payload.event as Record<string, unknown>

    // Only handle message events with files, skip bot messages
    if (
      event.type === 'message' &&
      event.files &&
      event.subtype !== 'bot_message' &&
      !event.bot_id
    ) {
      // Fire and forget — respond to Slack immediately, process in background
      processImageEvent(event).catch(console.error)
    }
  }

  return NextResponse.json({ ok: true })
}
