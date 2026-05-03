export interface iTunesTrack {
  id: string
  title: string
  artist: string
  album: string
  previewUrl: string
  duration: number
  artwork: string
}

export interface SearchOptions {
  limit?: number
}

/**
 * Map a curated playlist name to a high-quality iTunes search query.
 * Used by the Playlists screen to surface real, themed track lists.
 */
/** Shown under FEATURED CHARTS — same tile/play flow as curated, listed separately on HOME */
export const FEATURED_CHART_NAMES = [
  "Top 50 Global",
  "Top 50 USA",
  "Viral 50 Global",
  "Viral 50 USA",
] as const

export const FEATURED_CHART_NAME_SET = new Set<string>(FEATURED_CHART_NAMES as unknown as string[])

export const CURATED_PLAYLISTS: Record<string, string> = {
  "This Is The Weeknd": "the weeknd",
  "Lo-Fi Beats": "lofi hip hop",
  "Cyberpunk 2077 Radio": "synthwave",
  "Night Drive": "the midnight",
  "Focus Mode": "ludovico einaudi",
  "Top Hits 2024": "top hits 2024",
  "Indie Rock": "tame impala",
  "Jazz Lounge": "miles davis",
  "Top 50 Global": "top songs global",
  "Top 50 USA": "top songs usa",
  "Viral 50 Global": "viral hits global",
  "Viral 50 USA": "viral hits usa",
}

/** Cover art paths for curated grids / player UI */
export const CURATED_PLAYLIST_IMAGES: Record<string, string> = {
  "This Is The Weeknd": "/playlist-this-is-the-weeknd.png",
  "Lo-Fi Beats": "/playlist-lofi-beats.png",
  "Cyberpunk 2077 Radio": "/playlist-cyberpunk-2077-radio.png",
  "Night Drive": "/playlist-night-drive.png",
  "Focus Mode": "/playlist-focus-mode.png",
  "Top Hits 2024": "/playlist-top-hits-2024.png",
  "Indie Rock": "/playlist-indie-rock.png",
  "Jazz Lounge": "/playlist-jazz-lounge.png",
  "Top 50 Global": "/chart-top-50-global.png",
  "Top 50 USA": "/chart-top-50-usa.png",
  "Viral 50 Global": "/chart-viral-50-global.png",
  "Viral 50 USA": "/chart-viral-50-usa.png",
}

export function getCuratedPlaylistCover(playlistName: string): string {
  return CURATED_PLAYLIST_IMAGES[playlistName] ?? "/favicon.png"
}

/** Default track count requested for curated / featured playlist loads */
export const DEFAULT_CURATED_FETCH_LIMIT = 15

/** Title-case words for display */
function titleCaseWords(s: string) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}

/**
 * Featured charts use marketing keys ("Top 50 Global") but we only run the mapped iTunes `q`
 * (e.g. "top songs global") with a small limit — show that query + limit, not "50".
 */
export function getFeaturedChartDisplayLabel(chartKey: string, limit: number): string {
  if (!FEATURED_CHART_NAME_SET.has(chartKey)) return chartKey
  const q = CURATED_PLAYLISTS[chartKey] ?? chartKey
  return `${titleCaseWords(q)} · ${limit}`
}

/** Curated / chart name shown in UI: charts → query·limit; others unchanged */
export function getPlaylistDisplayLabel(
  playlistName: string,
  limit = DEFAULT_CURATED_FETCH_LIMIT,
): string {
  if (FEATURED_CHART_NAME_SET.has(playlistName)) {
    return getFeaturedChartDisplayLabel(playlistName, limit)
  }
  return playlistName
}

export async function searchITunes(query: string, opts: SearchOptions = {}): Promise<iTunesTrack[]> {
  if (!query.trim()) return []

  try {
    const params = new URLSearchParams({ q: query })
    if (opts.limit) params.set("limit", String(opts.limit))
    const response = await fetch(`/api/itunes?${params.toString()}`)
    const data = await response.json()
    if (!response.ok) {
      console.error("[iTunes] API error:", data?.error ?? response.status)
    }
    return data.results ?? []
  } catch (error) {
    console.error("[iTunes] search error:", error)
    return []
  }
}

export async function getCuratedPlaylist(
  name: string,
  limit = DEFAULT_CURATED_FETCH_LIMIT,
): Promise<iTunesTrack[]> {
  const query = CURATED_PLAYLISTS[name] ?? name
  return searchITunes(query, { limit })
}
