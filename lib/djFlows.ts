/** Rotating prompt angles so Groq returns varied DJ copy (used by `/api/dj`). */

export const DJ_FLOW_COUNT = 5

export type DjFlowIndex = 0 | 1 | 2 | 3 | 4

export function normalizeDjFlowIndex(n: unknown): DjFlowIndex {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v)) return 0
  const m = ((v % DJ_FLOW_COUNT) + DJ_FLOW_COUNT) % DJ_FLOW_COUNT
  return m as DjFlowIndex
}

export const INTRO_FLOW_SYSTEM: readonly string[] = [
  "Intro style: rooftop FM takeover, golden hour, crowd rolling in.",
  "Intro style: underground warehouse, red haze, subs waking up.",
  "Intro style: late-night drive radio, city lights blur, windows down.",
  "Intro style: beach shack soundsystem, barefoot energy, first wave.",
  "Intro style: neon arcade afterparty, glitchy warmth, joystick swagger.",
]

export const INTRO_FLOW_USER: readonly string[] = [
  "Welcome like you are opening a sunset session; hype without cringe.",
  "Welcome like a warehouse resident; tight, confident, no stage directions.",
  "Welcome like a midnight host between drops; smooth, cinematic.",
  "Welcome like a shoreline DJ; breezy slang, invite the room in.",
  "Welcome like a synthwave host; playful future tone, still human.",
]

export const TRANSITION_FLOW_SYSTEM: readonly string[] = [
  "Handoff tone: festival mainstage handoff, big room lift.",
  "Handoff tone: intimate club booth, whisper-to-roar build.",
  "Handoff tone: college radio chaos, charming and fast.",
  "Handoff tone: pirate radio static, rebellious but clear on the next cut.",
  "Handoff tone: afterhours loft, tired-but-hyped friends still dancing.",
]

export const TRANSITION_FLOW_USER: readonly string[] = [
  "Bridge the two tracks like a live blend; tease energy then name what is next.",
  "Keep it punchy; one confident bridge line, then the next title lands clean.",
  "Sound like you are riding the fader between vibes; no filler words.",
  "Make the queue feel intentional; nod to the room, then the incoming track.",
  "Close the chapter on the last cut, open the door on the next—radio tight.",
]
