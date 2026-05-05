// ElevenLabs Text-to-Speech Service
// Uses the local /api/tts route so API keys stay server-side.

// Default voice IDs from ElevenLabs
export const VOICES = {
  charlie: "IKne3meq5aSn9XLyUdCD", // Charlie - deep, confident, energetic
  rachel: "21m00Tcm4TlvDq8ikWAM", // Rachel - warm female
  adam: "pNInz6obpgDQGcFmaJgB", // Adam - deep male
  antoni: "ErXwobaYiN019PkySvjV", // Antoni - male
  elli: "MF3mGyEYCl7XYWbV9V6O", // Elli - young female
  josh: "TxGEqnHWrfWFTfGW9XjX", // Josh - young male
  arnold: "VR6AewLTigWG4xSOukaG", // Arnold - deep male
  sam: "yoZ06aMxZJJ28mfd3POQ", // Sam - young male
}

export interface ElevenLabsOptions {
  voiceId?: string
  modelId?: string
  stability?: number // 0-1, default 0.5
  similarityBoost?: number // 0-1, default 0.75
  style?: number // 0-1, default 0
  speed?: number // 0.7-1.2, default 1
  useSpeakerBoost?: boolean
  delivery?: string
}

/** Active ElevenLabs playback so we can stop it when leaving AI DJ or interrupting. */
let playingElevenLabs: HTMLAudioElement | null = null
/** Resolves the in-flight `speakWithElevenLabs` promise (natural end or `stop`). */
let endSpeak: (() => void) | null = null
let lastElevenLabsStatus = "idle"

/**
 * iOS Safari requires every <audio> element to be touched inside a user gesture
 * before it can play programmatically. We re-use a single primed element for
 * all TTS playback instead of `new Audio()` per utterance so iPhones can speak.
 */
let primedTtsAudio: HTMLAudioElement | null = null
const SILENT_AUDIO_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA=="

/**
 * Call from inside a user gesture (e.g. splash tap) to create + unlock a reusable
 * TTS audio element for iOS Safari. Safe to call multiple times.
 */
export function primeTtsAudio(): void {
  if (typeof window === "undefined") return
  if (primedTtsAudio) return
  try {
    const a = new Audio()
    a.preload = "auto"
    a.setAttribute("playsinline", "")
    a.src = SILENT_AUDIO_DATA_URI
    a.volume = 0
    const p = a.play()
    if (p && typeof p.then === "function") {
      p.then(() => {
        a.pause()
        a.currentTime = 0
        a.volume = 1
      }).catch(() => {
        /* element is still considered user-activated even if play resolves late */
      })
    }
    primedTtsAudio = a
  } catch {
    /* ignore — fallback path below will create one on demand */
  }
}

export function stopElevenLabsPlayback(): void {
  const audio = playingElevenLabs
  const finish = endSpeak
  playingElevenLabs = null
  endSpeak = null
  if (audio) {
    audio.pause()
    audio.currentTime = 0
  }
  finish?.()
}

export function getElevenLabsStatus(): string {
  return lastElevenLabsStatus
}

export async function speakWithElevenLabs(
  text: string,
  options: ElevenLabsOptions = {},
): Promise<void> {
  const {
    voiceId = VOICES.adam,
    modelId = "eleven_v3",
    stability = 0.34,
    similarityBoost = 0.86,
    style = 0.62,
    speed = 1,
    useSpeakerBoost = true,
    delivery = "",
  } = options

  stopElevenLabsPlayback()
  lastElevenLabsStatus = "requesting"

  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: delivery ? `${delivery.trim()} ${text}` : text,
      voiceId,
      modelId,
      stability,
      similarityBoost,
      style,
      speed,
      useSpeakerBoost,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    lastElevenLabsStatus = errorStatus(response.status, detail)
    throw new Error(`ElevenLabs API error: ${response.status}${detail ? ` ${detail}` : ""}`)
  }

  const audioBlob = await response.blob()
  const audioUrl = URL.createObjectURL(audioBlob)

  // Reuse the iOS-primed element when available so Safari respects the user
  // gesture that originally unlocked playback. Falls back to a fresh Audio()
  // on desktop / unprimed contexts.
  const audio = primedTtsAudio ?? new Audio()
  audio.src = audioUrl
  audio.volume = 1
  playingElevenLabs = audio
  lastElevenLabsStatus = `audio ready (${Math.round(audioBlob.size / 1024)} KB)`

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let urlRevoked = false
    const revokeUrl = () => {
      if (urlRevoked) return
      urlRevoked = true
      try {
        URL.revokeObjectURL(audioUrl)
      } catch {
        /* ignore */
      }
    }

    const finish = () => {
      if (settled) return
      settled = true
      endSpeak = null
      revokeUrl()
      if (playingElevenLabs === audio) playingElevenLabs = null
      lastElevenLabsStatus = "ended"
      resolve()
    }

    endSpeak = finish

    audio.onended = () => {
      finish()
    }

    audio.onerror = () => {
      if (settled) return
      settled = true
      endSpeak = null
      revokeUrl()
      if (playingElevenLabs === audio) playingElevenLabs = null
      lastElevenLabsStatus = "playback error"
      reject(new Error("ElevenLabs audio element error"))
    }

    void audio
      .play()
      .then(() => {
        lastElevenLabsStatus = "playing"
      })
      .catch((e: unknown) => {
        if (settled) return
        settled = true
        endSpeak = null
        revokeUrl()
        if (playingElevenLabs === audio) playingElevenLabs = null
        lastElevenLabsStatus = e instanceof Error ? e.message : "play failed"
        reject(e instanceof Error ? e : new Error(String(e)))
      })
  })
}

function errorStatus(status: number, detail: string): string {
  return `error ${status}${detail ? `: ${detail.slice(0, 80)}` : ""}`
}

// Check if ElevenLabs is configured
export function isElevenLabsConfigured(): boolean {
  return true
}
