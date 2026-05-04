import { POPULAR_ARTISTS } from "@/lib/discovery"
import { CURATED_PLAYLIST_IMAGES, type iTunesTrack } from "@/lib/itunesService"

/**
 * Image while playing: prefer homepage queue tile (curated / chart / popular artist)
 * when present, then iTunes track art. Bump iTunes CDN thumbs to a larger size.
 */
export function playbackArtworkUrl(
  trackArtworkUrl: string | null | undefined,
  playlistCoverSrc: string | null | undefined,
): string | null {
  const p = playlistCoverSrc?.trim()
  if (p) return p
  const t = trackArtworkUrl?.trim()
  if (t) return bumpItunesArtworkSize(t)
  return null
}

/**
 * Same artwork resolution we use for homepage track rows: prefer the track's
 * own iTunes art, otherwise fall back to a popular-artist or curated-playlist
 * cover so AI-DJ / search tracks show the same image users see on home.
 */
export function resolveHomeStyleTrackArt(track: iTunesTrack): string | null {
  const stored = playbackArtworkUrl(track.artwork, null)
  if (stored && !stored.includes("favicon")) return stored

  const haystack = `${track.artist} ${track.album} ${track.title}`.toLowerCase()
  const artist = POPULAR_ARTISTS.find((a) => haystack.includes(a.name.toLowerCase()))
  if (artist) return artist.image

  if (haystack.includes("weeknd")) return CURATED_PLAYLIST_IMAGES["This Is The Weeknd"] ?? null
  if (haystack.includes("lo-fi") || haystack.includes("lofi")) return CURATED_PLAYLIST_IMAGES["Lo-Fi Beats"] ?? null
  if (haystack.includes("synthwave") || haystack.includes("cyberpunk"))
    return CURATED_PLAYLIST_IMAGES["Cyberpunk 2077 Radio"] ?? null
  if (haystack.includes("midnight")) return CURATED_PLAYLIST_IMAGES["Night Drive"] ?? null
  if (haystack.includes("einaudi") || haystack.includes("focus"))
    return CURATED_PLAYLIST_IMAGES["Focus Mode"] ?? null
  if (haystack.includes("tame impala") || haystack.includes("indie"))
    return CURATED_PLAYLIST_IMAGES["Indie Rock"] ?? null
  if (haystack.includes("miles davis") || haystack.includes("jazz"))
    return CURATED_PLAYLIST_IMAGES["Jazz Lounge"] ?? null

  return null
}

function bumpItunesArtworkSize(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url
  return url
    .replace(/100x100bb/gi, "600x600bb")
    .replace(/60x60bb/gi, "600x600bb")
    .replace(/30x30bb/gi, "600x600bb")
}
