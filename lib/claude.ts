import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface AnalysisResult {
  ocr: string
  analysis: string
  summary: string
}

/**
 * Analyze an image buffer with Claude Vision.
 * Returns structured OCR, analysis, and summary.
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<AnalysisResult> {
  const base64 = imageBuffer.toString('base64')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: 'Analyze this image. Return a JSON object with exactly three fields: "ocr" (all visible text extracted from the image, empty string if none), "analysis" (what this image shows, its context, key observations, and anything noteworthy), "summary" (2-3 sentence summary of the topic or content). Return only valid JSON, no markdown, no code blocks.',
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const parsed = JSON.parse(text)
    return {
      ocr: parsed.ocr ?? '',
      analysis: parsed.analysis ?? '',
      summary: parsed.summary ?? '',
    }
  } catch {
    // Fallback: return raw text as summary
    return { ocr: '', analysis: text, summary: text.slice(0, 300) }
  }
}
