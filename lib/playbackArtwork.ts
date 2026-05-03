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

function bumpItunesArtworkSize(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url
  return url
    .replace(/100x100bb/gi, "600x600bb")
    .replace(/60x60bb/gi, "600x600bb")
    .replace(/30x30bb/gi, "600x600bb")
}
