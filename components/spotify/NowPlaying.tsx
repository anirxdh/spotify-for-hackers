import type { MouseEvent } from "react"
import SidebarVisualizer from "@/components/spotify/SidebarVisualizer"
import { playbackArtworkUrl } from "@/lib/playbackArtwork"

const ASCII_ALBUM = `
    ##    ##  
   ####  ####  
  ## ## ## ##  
 ##  ####  ##  
##   ####   ## 
##    ##    ## 
##          ## 
 ##        ##  
  ##      ##   
   ########    
    ######     
      ##       
`

export default function NowPlaying({
  track,
  artist,
  album,
  currentTime,
  totalTime,
  playlistCoverSrc = null,
  playlistName = null,
  trackArtworkUrl = null,
  /** When false, omit the SIGNAL bar grid (e.g. AI DJ tab already has host visualizer). */
  showSignalVisualizer = true,
  isPlaying = false,
  onPlayPause,
  onNext,
  onPrev,
  isLiked = false,
  onLikeToggle,
  canLike = true,
  onSeek,
}: {
  track: string
  artist: string
  album: string
  currentTime: number
  totalTime: number
  playlistCoverSrc?: string | null
  playlistName?: string | null
  trackArtworkUrl?: string | null
  showSignalVisualizer?: boolean
  isPlaying?: boolean
  onPlayPause?: () => void
  onNext?: () => void
  onPrev?: () => void
  isLiked?: boolean
  onLikeToggle?: () => void
  canLike?: boolean
  onSeek?: (seconds: number) => void
}) {
  const pct = totalTime > 0 ? Math.round((currentTime / totalTime) * 100) : 0

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const artSrc = playbackArtworkUrl(trackArtworkUrl, playlistCoverSrc)

  const handleSeekBarClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onSeek || totalTime <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(Math.floor(p * totalTime))
  }

  const hasTransport = Boolean(onPlayPause || onNext || onPrev)

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-3">
      <div className="text-muted-foreground text-xs tracking-widest">
        {'>'} NOW PLAYING
      </div>

      <div className="relative min-h-0 w-full overflow-hidden rounded-sm bg-card aspect-square max-h-[min(52vh,400px)]">
        {artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full min-h-[180px] w-full items-center justify-center bg-[#030803] p-2">
            <pre className="ascii-art select-none opacity-80">{ASCII_ALBUM}</pre>
          </div>
        )}
      </div>

      {showSignalVisualizer ? <SidebarVisualizer isActive={isPlaying} /> : null}

      <div className="flex min-h-0 flex-col gap-2">
        {playlistName ? (
          <div className="text-muted-foreground text-[10px] font-mono tracking-widest truncate bg-card/80 px-2 py-1.5">
            {">"} QUEUE FROM <span className="text-primary">{playlistName}</span>
          </div>
        ) : null}

        <div className="bg-card p-4">
          <div className="text-primary text-sm font-mono font-bold text-glow truncate">{track || "no track loaded"}</div>
          <div className="text-muted-foreground text-xs mt-0.5 truncate">{artist || "search or choose a playlist"}</div>
          <div className="text-muted-foreground text-xs truncate">{album || "standby"}</div>

          {/* One row: elapsed | prev/play/next/♡ | seek bar | duration */}
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2 min-w-0">
            <span className="w-9 shrink-0 text-[10px] tabular-nums text-muted-foreground">{fmt(currentTime)}</span>

            {hasTransport ? (
              <div className="flex shrink-0 items-center gap-px" aria-label="Playback">
                <button
                  type="button"
                  onClick={() => onPrev?.()}
                  disabled={!onPrev}
                  className="flex h-7 w-6 items-center justify-center rounded text-[10px] text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary disabled:opacity-30"
                  title="Previous"
                >
                  &#9664;&#9664;
                </button>
                <button
                  type="button"
                  onClick={() => onPlayPause?.()}
                  disabled={!onPlayPause}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-mono transition-all duration-150 disabled:opacity-40 ${
                    isPlaying
                      ? "bg-primary text-primary-foreground text-glow hover:bg-accent hover:text-primary"
                      : "bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground"
                  }`}
                  title="Play / Pause"
                >
                  {isPlaying ? "▐▐" : "▶"}
                </button>
                <button
                  type="button"
                  onClick={() => onNext?.()}
                  disabled={!onNext}
                  className="flex h-7 w-6 items-center justify-center rounded text-[10px] text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary disabled:opacity-30"
                  title="Next"
                >
                  &#9654;&#9654;
                </button>
                {canLike && onLikeToggle ? (
                  <button
                    type="button"
                    onClick={() => onLikeToggle()}
                    className={`flex h-7 w-6 items-center justify-center text-sm leading-none transition-colors ${
                      isLiked ? "text-primary text-glow-sm" : "text-muted-foreground hover:text-primary"
                    }`}
                    aria-pressed={isLiked}
                    aria-label={isLiked ? "Unlike" : "Like"}
                  >
                    {isLiked ? "♥" : "♡"}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div
              role={onSeek && totalTime > 0 ? "slider" : undefined}
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={totalTime}
              onClick={handleSeekBarClick}
              className={`relative h-1.5 min-w-[3rem] flex-1 basis-[5rem] overflow-hidden rounded-full bg-secondary ${
                onSeek && totalTime > 0 ? "cursor-pointer hover:ring-1 hover:ring-primary/30" : ""
              }`}
            >
              <div
                className="h-full rounded-full bg-primary progress-glow transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {fmt(totalTime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
