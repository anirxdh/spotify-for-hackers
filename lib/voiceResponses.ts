// AI DJ short lines — one bank per on-screen host (Nova, Velvet, Pulse, Kai).
// Groq `/api/dj` still writes long transitions; these are the quick terminal-trigger quips.

export type VoiceContext =
  | "play"
  | "search"
  | "skip"
  | "prev"
  | "pause"
  | "resume"
  | "auto-dj"
  | "vibe-mode"
  | "volume"
  | "error"

type Bank = Record<VoiceContext, string[]>

/** DJ NOVA — bright club / female energy */
const nova: Bank = {
  play: ["Lights up — queue is live.", "Crowd heat rising, here we go.", "Main stage signal: go."],
  search: ["Digging crates for your next anthem...", "Scanning charts for the biggest hook...", "Finding the spark you asked for..."],
  skip: ["Skipping — next drop incoming.", "Cutting clean to the next banger.", "Moving the floor forward."],
  prev: ["Rewind — we ride that wave again.", "Back one — same magic.", "Previous cut, still hot."],
  pause: ["Hold the room — paused.", "Quick breath — audio down.", "Pausing the storm."],
  resume: ["Back on air — play!", "Resume the party pulse.", "We rolling again."],
  "auto-dj": ["Nova’s got the board — auto DJ live.", "Handing me the faders — autonomous mix on.", "I’m driving the queue now."],
  "vibe-mode": ["Neon up — vibe mode on.", "Room goes full spectrum.", "Visuals and bass: locked."],
  volume: ["Levels tweaked — feel that.", "Gain riding smooth.", "Volume dialed for the room."],
  error: ["Didn’t catch that command.", "Try that line again?", "Syntax slipped — one more time."],
}

/** DJ VELVET — late-night smooth / male */
const velvet: Bank = {
  play: ["Easy now — we fade in.", "Let this one breathe.", "Smooth lock on your selection."],
  search: ["Browsing the late stack...", "Slow search through the vault...", "Finding something velvet for you..."],
  skip: ["Gentle skip — next track.", "Crossfade forward.", "Sliding to the next groove."],
  prev: ["Stepping back one track.", "Previous selection, still warm.", "Rewind with grace."],
  pause: ["Paused — room holds still.", "Quiet moment.", "Playback rests."],
  resume: ["And we glide back in.", "Continuing the night ride.", "Audio returns, soft."],
  "auto-dj": ["Velvet mode — I’ll mind the transitions.", "Auto DJ: I’ll keep the night smooth.", "Let me steer the blend."],
  "vibe-mode": ["Lights dial down — mood shift.", "Vibe lane engaged.", "Atmosphere thickens."],
  volume: ["Levels adjusted — balanced.", "Volume set for the lounge.", "Output softened or lifted."],
  error: ["That command didn’t land.", "Couldn’t parse that one.", "Say it once more, slower."],
}

/** DJ PULSE — techno precision / female */
const pulse: Bank = {
  play: ["Grid locked — playback armed.", "Signal path: clear. Execute.", "Transport engaged."],
  search: ["Querying archive nodes...", "Binary search for your request...", "Indexing catalog..."],
  skip: ["Advance cue — next locked.", "Skip pulse sent.", "Forward frame."],
  prev: ["Reverse step — prior track.", "Rollback one index.", "Previous buffer."],
  pause: ["Clock stopped.", "Transport halt.", "Silence gate."],
  resume: ["Clock resume.", "Stream re-armed.", "Continue sequence."],
  "auto-dj": ["Autopilot engaged — Pulse on mix.", "Neural crossfader: mine.", "Auto-DJ: precision routing."],
  "vibe-mode": ["HUD intensified — vibe protocol.", "Visual layer boosted.", "Sensory stack: extended."],
  volume: ["Gain staged.", "Amplitude node updated.", "Headroom recalculated."],
  error: ["Invalid opcode.", "Command rejected.", "Parse fault — retry."],
}

/** DJ KAI — hype MC / male */
const kai: Bank = {
  play: ["Yo — we live!", "Let’s run it!", "Deck’s hot — go time!"],
  search: ["I’m hunting that track for you...", "Digging for the hit...", "Search squad mobilized..."],
  skip: ["Next one — don’t blink!", "Skipping — keep the bounce!", "Fresh cut rolling in!"],
  prev: ["Run that back!", "Previous joint — still fire!", "One back — crowd knows it!"],
  pause: ["Hold up — pause!", "Quick stall!", "Freeze frame!"],
  resume: ["We back!", "Run it back loud!", "Resume the hype!"],
  "auto-dj": ["Kai’s on auto — hands in the air!", "I’m mixing while you dance!", "Auto DJ — I got you!"],
  "vibe-mode": ["Party skin: ON!", "Vibe check: passed!", "Full party mode!"],
  volume: ["Levels moved — feel it!", "Volume tap — there it is!", "Louder or smoother — done."],
  error: ["That didn’t hit — try again!", "Nah, didn’t get that.", "Say it different!"],
}

const HOST_VOICE_BANKS: Bank[] = [nova, velvet, pulse, kai]

/** Generic fallback if host index is ever out of range */
const defaultBank: Bank = HOST_VOICE_BANKS[0]

function bankForHost(hostIndex: number): Bank {
  return HOST_VOICE_BANKS[hostIndex] ?? defaultBank
}

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0]
}

/** When a track title is known — host-specific one-liner */
function playWithTrackLine(hostIndex: number, trackName: string): string {
  const lines = [
    `Nova here — spinning ${trackName}. Let’s move.`,
    `Velvet rolling ${trackName} — settle in.`,
    `Pulse locked on ${trackName}. Execute play.`,
    `Kai drops ${trackName} — turn it up!`,
  ]
  return lines[hostIndex] ?? lines[0]
}

function skipWithTrackLine(hostIndex: number, trackName: string): string {
  const lines = [
    `Next wave — ${trackName}.`,
    `Gliding into ${trackName}.`,
    `Cue advance — ${trackName}.`,
    `Here comes ${trackName}!`,
  ]
  return lines[hostIndex] ?? lines[0]
}

export function getVoiceResponse(context: VoiceContext, trackName?: string, hostIndex = 0): string {
  const bank = bankForHost(hostIndex)

  if (context === "play" && trackName) {
    return playWithTrackLine(hostIndex, trackName)
  }

  if (context === "skip" && trackName) {
    return skipWithTrackLine(hostIndex, trackName)
  }

  return pick(bank[context])
}

export function shouldTriggerVoice(command: string): VoiceContext | null {
  const cmd = command.toLowerCase().trim()
  const normalized = cmd.replace(/[\s_]+/g, "-")

  if (cmd.startsWith("play")) return "play"
  if (cmd.startsWith("search")) return "search"
  if (cmd === "skip") return "skip"
  if (cmd === "prev") return "prev"
  if (cmd === "pause") return "pause"
  if (cmd === "resume") return "resume"
  if (normalized === "sudo-auto-dj" || normalized === "sudo-autodj" || normalized === "sudo-dj") return "auto-dj"
  if (normalized === "sudo-vibe-mode") return "vibe-mode"
  if (cmd.startsWith("volume")) return "volume"

  return null
}
