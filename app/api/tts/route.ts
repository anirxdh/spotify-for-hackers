import { NextRequest, NextResponse } from "next/server"

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"
const DEFAULT_MODEL_ID = "eleven_v3"

export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key is not configured." }, { status: 401 })
  }

  try {
    const body = await request.json()
    const text = String(body.text ?? "").trim()
    const voiceId = String(body.voiceId ?? DEFAULT_VOICE_ID)
    const modelId = String(body.modelId ?? DEFAULT_MODEL_ID)
    const stability = clampNumber(body.stability, 0.34)
    const similarityBoost = clampNumber(body.similarityBoost, 0.86)
    const style = clampNumber(body.style, 0.62)
    const speed = clampNumber(body.speed, 1, 0.7, 1.2)
    const useSpeakerBoost = typeof body.useSpeakerBoost === "boolean" ? body.useSpeakerBoost : true

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 })
    }

    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          speed,
          use_speaker_boost: useSpeakerBoost,
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      console.error("[tts] ElevenLabs API error", response.status, detail)
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}`, detail },
        { status: 500 },
      )
    }

    const audio = await response.arrayBuffer()

    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[tts] Failed to generate speech", error)
    return NextResponse.json({ error: "Failed to generate speech." }, { status: 500 })
  }
}

function clampNumber(value: unknown, fallback: number, min = 0, max = 1) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(min, Math.min(max, next))
}
