import { NextRequest, NextResponse } from "next/server"
import {
  normalizeDjFlowIndex,
  INTRO_FLOW_SYSTEM,
  INTRO_FLOW_USER,
  TRANSITION_FLOW_SYSTEM,
  TRANSITION_FLOW_USER,
} from "@/lib/djFlows"

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.1-8b-instant"
const DJ_SYSTEM_PROMPT =
  "You are SYS.DJ, a live cyberpunk party host inside a terminal music app. Speak like a real DJ on a mic: warm crowd control, quick slang, no cringe, no filler, no stage directions. One spoken line only. Keep it under 22 words. Mention the next song or artist when available. No markdown, no hashtags, no quotes."

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: "Groq API key is not configured." },
      { status: 401 },
    )
  }

  try {
    const body = await request.json()
    const mode = String(body.mode ?? "transition")
    const flowIndex = normalizeDjFlowIndex(body.flowIndex)
    const current = body.currentTrack ?? null
    const next = body.nextTrack ?? null
    const queueSize = Number(body.queueSize ?? 0)
    const hostPersona = typeof body.hostPersona === "string" ? body.hostPersona.trim() : ""
    const personaBlock = hostPersona ? ` ${hostPersona}` : ""
    const hostJourneyLens = typeof body.hostJourneyLens === "string" ? body.hostJourneyLens.trim() : ""
    const hostJourneyUserHint = typeof body.hostJourneyUserHint === "string" ? body.hostJourneyUserHint.trim() : ""
    const journeyLensBlock = hostJourneyLens ? ` Host journey lens: ${hostJourneyLens}` : ""
    const journeyUserBlock = hostJourneyUserHint ? ` ${hostJourneyUserHint}` : ""

    if (mode === "intro") {
      const openerTrack = next?.title && next?.artist
        ? `The first track is "${next.title}" by ${next.artist}.`
        : "The first track is loading now."

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 1,
          max_tokens: 80,
          messages: [
            {
              role: "system",
              content:
                `${DJ_SYSTEM_PROMPT}${personaBlock} For intro mode, welcome everyone like the party is starting and make it sound energetic. ${INTRO_FLOW_SYSTEM[flowIndex]}${journeyLensBlock}`,
            },
            {
              role: "user",
              content: `Open the set now. ${openerTrack} Direction: ${INTRO_FLOW_USER[flowIndex]}${journeyUserBlock}`,
            },
          ],
        }),
      })

      if (!response.ok) {
        return NextResponse.json({ line: "Hello everyone, let's enter the party island. I got the next wave locked and ready." })
      }

      const data = await response.json()
      const line = String(data.choices?.[0]?.message?.content ?? "").trim()
      return NextResponse.json({ line: line || "Hello everyone, let's enter the party island. I got the next wave locked and ready." })
    }

    if (!next?.title || !next?.artist) {
      return NextResponse.json({ line: "Queue signal is weak. Load a track and I will mix it in." })
    }

    const transition = current?.title
      ? `Transitioning from "${current.title}" by ${current.artist} into "${next.title}" by ${next.artist}.`
      : `Opening the set with "${next.title}" by ${next.artist}.`

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.9,
        max_tokens: 70,
        messages: [
          {
            role: "system",
            content: `${DJ_SYSTEM_PROMPT}${personaBlock} ${TRANSITION_FLOW_SYSTEM[flowIndex]}${journeyLensBlock}`,
          },
          {
            role: "user",
            content: `${transition} Queue size: ${queueSize}. ${TRANSITION_FLOW_USER[flowIndex]}${journeyUserBlock}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Groq API error: ${response.status}`, line: fallbackLine(next.title, next.artist) },
        { status: 200 },
      )
    }

    const data = await response.json()
    const line = String(data.choices?.[0]?.message?.content ?? "").trim()

    return NextResponse.json({ line: line || fallbackLine(next.title, next.artist) })
  } catch {
    return NextResponse.json({ line: "Signal distortion detected. Dropping the next track now." }, { status: 200 })
  }
}

function fallbackLine(title: string, artist: string) {
  return `Locked into the next signal: ${title} by ${artist}.`
}
