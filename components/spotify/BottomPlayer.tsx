"use client"

import { useState } from "react"
import { playbackArtworkUrl } from "@/lib/playbackArtwork"

function VolumeBar({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const total = 12
  const filled = Math.round((value / 100) * total)

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onChange(Math.round(pct * 100))
  }

  return (
    <div
      onClick={handleClick}
      className="flex items-end gap-px h-3 cursor-pointer"
      role="slider"
      aria-label="Volume"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-[3px] transition-colors ${i < filled ? "bg-primary progress-glow" : "bg-border hover:bg-muted-foreground"}`}
          style={{ height: `${40 + i * 5}%` }}
        />
      ))}
    </div>
  )
}

export default function BottomPlayer({
  track,
  artist,
  album,
  currentTime,
  totalTime,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  volume,
  onVolumeChange,
  isShuffle = false,
  onShuffleToggle,
  isRepeat = false,
  onRepeatToggle,
  isLiked = false,
  onLikeToggle,
  playlistCoverSrc = null,
  playlistName = null,
  trackArtworkUrl = null,
  onOpenNowPlaying,
}: {
  track: string
  artist: string
  album: string
  currentTime: number
  totalTime: number
  isPlaying: boolean
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek?: (seconds: number) => void
  volume?: number
  onVolumeChange?: (volume: number) => void
  isShuffle?: boolean
  onShuffleToggle?: () => void
  isRepeat?: boolean
  onRepeatToggle?: () => void
  isLiked?: boolean
  onLikeToggle?: () => void
  /** Curated playlist artwork when the active queue is from a playlist */
  playlistCoverSrc?: string | null
  playlistName?: string | null
  /** iTunes track artwork — shown when set or when playlist cover is missing */
  trackArtworkUrl?: string | null
  /** Opens / expands the right Now Playing sidebar (artwork + title area) */
  onOpenNowPlaying?: () => void
}) {
  const volumeValue = volume ?? 70
  const thumbSrc = playbackArtworkUrl(trackArtworkUrl, playlistCoverSrc)

  const handleVolumeChange = (newVol: number) => {
    onVolumeChange?.(newVol)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || totalTime <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(Math.floor(pct * totalTime))
  }

  const pct = Math.round((currentTime / totalTime) * 100)
  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  return (
    <footer className="flex-shrink-0 bg-background">
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
        {/* Track info — click artwork/title to expand Now Playing sidebar */}
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-[260px] sm:min-w-[200px]">
          <button
            type="button"
            onClick={() => onOpenNowPlaying?.()}
            disabled={!track || !onOpenNowPlaying}
            className="flex min-w-0 flex-1 items-center gap-3 rounded px-1 py-0.5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent disabled:opacity-70"
            aria-label="Open now playing panel"
          >
            <div className="pointer-events-none flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden bg-card sm:h-16 sm:w-16">
              {thumbSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbSrc}
                  alt=""
                  className="theme-tint-art w-full h-full object-cover"
                  title={playlistName ?? undefined}
                />
              ) : (
                <pre className="ascii-art text-center" style={{ fontSize: "4px", lineHeight: 1 }}>
                  {`##  ##
#### 
## ##
####
## ##`}
                </pre>
              )}
            </div>
            <div className="min-w-0 flex-1 pointer-events-none">
              {track ? (
                <>
                  <div className={`text-primary text-xs font-mono font-bold truncate ${isPlaying ? "text-glow-sm" : ""}`}>
                    {track}
                  </div>
                  <div className="text-muted-foreground text-xs truncate">{artist}</div>
                  {playlistName ? (
                    <div className="text-primary/80 text-[10px] truncate" title={playlistName}>
                      {">"} {playlistName}
                    </div>
                  ) : null}
                  <div className="text-muted-foreground text-xs opacity-60 truncate">{fmt(currentTime)} / {fmt(totalTime)}</div>
                </>
              ) : (
                <>
                  <div className="text-muted-foreground text-xs font-mono truncate">no track loaded</div>
                  <div className="text-muted-foreground text-xs opacity-60 truncate">type "search [artist]"</div>
                  <div className="text-muted-foreground text-xs opacity-60 truncate">--:-- / --:--</div>
                </>
              )}
            </div>
          </button>
          <button
            onClick={() => onLikeToggle?.()}
            disabled={!track}
            className={`text-base flex-shrink-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isLiked ? "text-primary text-glow-sm" : "text-muted-foreground hover:text-primary"}`}
            aria-pressed={isLiked}
            aria-label={isLiked ? "Unlike" : "Like"}
          >
            {isLiked ? "♥" : "♡"}
          </button>
        </div>

        {/* Center: controls + progress */}
        <div className="flex w-full flex-col items-center gap-2 sm:flex-1">
          {/* Playback controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onShuffleToggle?.()}
              className={`text-xs font-mono transition-colors ${isShuffle ? "text-primary text-glow-sm" : "text-muted-foreground hover:text-primary"}`}
              title="Shuffle"
              aria-pressed={isShuffle}
            >
              ⇄
            </button>
            <button
              onClick={onPrev}
              className="text-muted-foreground hover:text-primary transition-colors text-sm"
              title="Previous [P]"
            >
              &#9664;&#9664;
            </button>
            <button
              onClick={onPlayPause}
              type="button"
              className={`player-transport-play flex h-11 w-11 items-center justify-center rounded-md font-mono text-base transition-all duration-150 sm:h-9 sm:w-9 sm:text-sm ${
                isPlaying
                  ? "bg-primary text-primary-foreground text-glow hover:bg-accent hover:text-primary"
                  : "bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground"
              }`}
              title="Play/Pause [Space]"
            >
              {isPlaying ? "▐▐" : "▶"}
            </button>
            <button
              onClick={onNext}
              className="text-muted-foreground hover:text-primary transition-colors text-sm"
              title="Next [N]"
            >
              &#9654;&#9654;
            </button>
            <button
              onClick={() => onRepeatToggle?.()}
              className={`text-xs font-mono transition-colors ${isRepeat ? "text-primary text-glow-sm" : "text-muted-foreground hover:text-primary"}`}
              title="Repeat"
              aria-pressed={isRepeat}
            >
              ↺
            </button>
          </div>

          {/* Progress bar - clickable to seek */}
          <div className="w-full flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-mono w-8 text-right flex-shrink-0">{fmt(currentTime)}</span>
            <div
              onClick={handleSeek}
              className="flex-1 h-1 bg-secondary relative cursor-pointer group"
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={totalTime}
              aria-valuenow={currentTime}
            >
              <div
                className="h-full bg-primary progress-glow relative"
                style={{ width: `${pct}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* Hover indicator */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 pointer-events-none" />
            </div>
            <span className="text-muted-foreground text-xs font-mono w-8 flex-shrink-0">{fmt(totalTime)}</span>
          </div>
        </div>

        {/* Right: Volume */}
        <div className="flex w-full shrink-0 items-center justify-between border-t border-primary/10 pt-2 sm:w-[180px] sm:min-w-[140px] sm:justify-end sm:border-t-0 sm:pt-0">
          <div className="flex w-full flex-row items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-start sm:gap-1">
            <div className="text-muted-foreground text-xs tracking-widest">{'>'} VOLUME <span className="text-primary">[↑↓]</span></div>
            <div className="flex items-center gap-2 sm:self-end">
              <VolumeBar value={volumeValue} onChange={handleVolumeChange} />
              <span className="inline-flex items-center gap-0 text-xs font-mono">
                <span className="text-primary tabular-nums">{volumeValue}%</span>
                <button
                  type="button"
                  onClick={() => handleVolumeChange(volumeValue > 0 ? 0 : 70)}
                  className="text-muted-foreground hover:text-primary transition-colors shrink-0 pl-px"
                  title="Mute/Unmute [M]"
                  aria-label="Mute"
                >
                  [M]
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
