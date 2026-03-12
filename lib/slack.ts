import { createHmac, timingSafeEqual } from 'crypto'
import { WebClient } from '@slack/web-api'

export const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

/**
 * Verify that a request came from Slack using HMAC-SHA256.
 */
export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const fiveMinutes = 5 * 60
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > fiveMinutes) return false

  const sigBase = `v0:${timestamp}:${body}`
  const hmac = createHmac('sha256', signingSecret).update(sigBase).digest('hex')
  const computed = `v0=${hmac}`

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
  } catch {
    return false
  }
}

/**
 * Download a Slack file by its URL, authenticated with the bot token.
 * Returns a Buffer.
 */
export async function downloadSlackFile(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  })
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Post a formatted analysis reply into a Slack thread.
 */
export async function postAnalysisReply(
  channel: string,
  threadTs: string,
  result: { ocr: string; analysis: string; summary: string },
  fileName: string
): Promise<void> {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Summary*\n${result.summary}`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Analysis*\n${result.analysis}`,
      },
    },
  ]

  // Only include OCR block if there's text
  if (result.ocr.trim()) {
    blocks.push({ type: 'divider' } as never)
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Extracted Text*\n\`\`\`${result.ocr.slice(0, 2900)}\`\`\``,
      },
    } as never)
  }

  await slack.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `Analysis for ${fileName}`,
    blocks,
  })
}
