import type { iTunesTrack } from "@/lib/itunesService"

// Lightweight mock track list used as a fallback for command parser
// when no live iTunes results are available.
export interface MockTrack {
  id: number
  title: string
  artist: string
  album: string
  time: string
  explicit: boolean
}

export const tracks: MockTrack[] = [
  { id: 1, title: "blinding lights",       artist: "The Weeknd",              album: "After Hours",            time: "3:20", explicit: false },
  { id: 2, title: "Starboy",               artist: "The Weeknd, Daft Punk",   album: "Starboy",                time: "3:50", explicit: false },
  { id: 3, title: "Redbone",               artist: "Childish Gambino",        album: '"Awaken, My Love!"',     time: "5:27", explicit: false },
  { id: 4, title: "Snooze",                artist: "SZA",                     album: "SOS",                    time: "3:21", explicit: true  },
  { id: 5, title: "Digital Bath",          artist: "Deftones",                album: "White Pony",             time: "4:15", explicit: true  },
  { id: 6, title: "The Less I Know The Better", artist: "Tame Impala",        album: "Currents",               time: "3:36", explicit: false },
  { id: 7, title: "i like the way you kiss me", artist: "Artemas",            album: "i like the way you kiss me", time: "2:22", explicit: true  },
]

/** Stable id prefix so liked-state keys match `itunes:${id}` storage used for real iTunes tracks */
export const MOCK_LIKED_ID_PREFIX = "local-"

/** Shape used for liked-playlist storage so mock likes share one pipeline with iTunes likes */
export function mockTrackToLikedEntry(t: MockTrack): iTunesTrack {
  const [m, s] = t.time.split(":").map(Number)
  const mm = Number.isFinite(m) ? m : 0
  const ss = Number.isFinite(s) ? s : 0
  return {
    id: `${MOCK_LIKED_ID_PREFIX}${t.id}`,
    title: t.title,
    artist: t.artist,
    album: t.album,
    previewUrl: "",
    duration: mm * 60 + ss,
    artwork: "",
  }
}
