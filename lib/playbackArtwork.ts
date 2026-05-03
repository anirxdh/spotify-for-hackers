/**
 * Image shown while playing: prefer the track's album/single art when present,
 * otherwise curated playlist / chart cover. Bump iTunes CDN thumbs to a larger size.
 */
export function playbackArtworkUrl(
  trackArtworkUrl: string | null | undefined,
  playlistCoverSrc: string | null | undefined,
): string | null {
  const t = trackArtworkUrl?.trim()
  if (t) return bumpItunesArtworkSize(t)
  const p = playlistCoverSrc?.trim()
  return p || null
}

function bumpItunesArtworkSize(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url
  return url
    .replace(/100x100bb/gi, "600x600bb")
    .replace(/60x60bb/gi, "600x600bb")
    .replace(/30x30bb/gi, "600x600bb")
}
