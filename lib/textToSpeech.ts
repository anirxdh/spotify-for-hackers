import {
  speakWithElevenLabs,
  isElevenLabsConfigured,
  stopElevenLabsPlayback,
} from "./elevenLabsService"

export interface SpeechConfig {
  rate?: number
  pitch?: number
  volume?: number
  useElevenLabs?: boolean
  fallbackToBrowser?: boolean
  voiceId?: string
  modelId?: string
  stability?: number
  similarityBoost?: number
  style?: number
  speed?: number
  useSpeakerBoost?: boolean
  delivery?: string
}

const DEFAULT_CONFIG: SpeechConfig = {
  rate: 1.2,
  pitch: 1.0,
  volume: 1.0,
  useElevenLabs: true,
  fallbackToBrowser: true,
}

export async function speak(text: string, config: SpeechConfig = DEFAULT_CONFIG): Promise<void> {
  // Try ElevenLabs first if configured and enabled
  if (config.useElevenLabs && isElevenLabsConfigured()) {
    try {
      await speakWithElevenLabs(text, {
        voiceId: config.voiceId,
        modelId: config.modelId,
        stability: config.stability,
        similarityBoost: config.similarityBoost,
        style: config.style,
        speed: config.speed,
        useSpeakerBoost: config.useSpeakerBoost,
        delivery: config.delivery,
      })
      return
    } catch (error) {
      console.warn("[v0] ElevenLabs failed", error)
      if (config.fallbackToBrowser === false) throw error
      console.warn("[v0] falling back to Web Speech API")
    }
  }
  
  // Fall back to Web Speech API
  return speakBrowser(text, config)
}

export function speakBrowser(text: string, config: SpeechConfig = DEFAULT_CONFIG): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check browser support
    const synth = window.speechSynthesis
    if (!synth) {
      console.error("[v0] Speech Synthesis not supported")
      reject(new Error("Speech Synthesis not supported"))
      return
    }

    // Cancel any ongoing speech
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = config.rate || 1.2
    utterance.pitch = config.pitch || 1.0
    utterance.volume = config.volume || 1.0

    // Use a more robotic/tech voice if available
    const voices = synth.getVoices()
    const techVoice = voices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Microsoft') || 
      v.name.includes('Samantha')
    )
    if (techVoice) {
      utterance.voice = techVoice
    }

    utterance.onend = () => {
      resolve()
    }

    utterance.onerror = (event) => {
      if (event.error === "interrupted" || event.error === "canceled") {
        resolve()
        return
      }
      console.error("[v0] Speech error:", event.error)
      reject(new Error(event.error))
    }

    synth.speak(utterance)
  })
}

export function stopSpeech() {
  stopElevenLabsPlayback()
  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel()
  }
}
