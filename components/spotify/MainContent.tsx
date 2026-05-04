"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react"
import {
  searchITunes,
  getCuratedPlaylist,
  getCuratedPlaylistCover,
  CURATED_PLAYLISTS,
  CURATED_PLAYLIST_IMAGES,
  FEATURED_CHART_NAMES,
  FEATURED_CHART_NAME_SET,
  getFeaturedChartDisplayLabel,
  getPlaylistDisplayLabel,
  DEFAULT_CURATED_FETCH_LIMIT,
  iTunesTrack,
} from "@/lib/itunesService"
import type { PopularArtist } from "@/lib/discovery"
import { POPULAR_ARTISTS } from "@/lib/discovery"
import type { CommandLog } from "@/lib/commandParser"
import { playbackArtworkUrl, resolveHomeStyleTrackArt } from "@/lib/playbackArtwork"
import { AI_DJ_HOSTS } from "@/lib/aiDjHosts"
import DockedTerminal from "@/components/spotify/DockedTerminal"
import type { TerminalHandle } from "@/components/spotify/Terminal"

const fmt = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Curated / charts / artist cover tiles — hover “flying paper” lift + tilt + stack shadow */
const HOME_GRID_PAPER =
  "relative z-0 overflow-hidden rounded-sm shadow-[0_1px_0_0_color-mix(in_oklab,var(--border)_55%,transparent)] transition-[box-shadow] duration-300 hover:z-30 hover:shadow-[0_0_28px_color-mix(in_oklab,var(--primary)_18%,transparent)] focus-within:z-30"

const HOME_WAVE_STRIPS = 14

function HomeWaveImage({ src }: { src: string }) {
  return (
    <div className="home-wave-surface theme-tint-art absolute inset-0" aria-hidden>
      {Array.from({ length: HOME_WAVE_STRIPS }).map((_, i) => (
        <span
          key={i}
          className="home-wave-strip"
          style={
            {
              "--i": i,
              "--n": HOME_WAVE_STRIPS,
              "--wave-shade": i % 4 === 0 ? 0.9 : i % 4 === 1 ? 1.18 : i % 4 === 2 ? 1.04 : 0.86,
              backgroundImage: `url("${src}")`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

interface TrackRowProps {
  index: number
  track: iTunesTrack
  thumbnailSrc: string
  isActive: boolean
  isLiked: boolean
  onPlay: () => void
  onLike: () => void
}

function TrackRow({ index, track, thumbnailSrc, isActive, isLiked, onPlay, onLike }: TrackRowProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPlay}
      className={`grid grid-cols-[44px_minmax(0,1fr)_30px] gap-2 px-2 py-2 text-xs font-mono transition-all duration-150 sm:grid-cols-[44px_minmax(0,1fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_60px_30px] sm:px-4 ${
        isActive ? "bg-accent text-primary row-active" : hovered ? "bg-secondary" : ""
      }`}
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm ring-1 ring-primary/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnailSrc} alt="" className="theme-tint-art h-full w-full object-cover" />
        {(hovered || isActive) && (
          <span
            className={`absolute inset-0 flex items-center justify-center bg-background/75 text-primary ${isActive ? "text-glow-sm" : ""}`}
            aria-hidden
          >
            &#9654;
          </span>
        )}
        {!hovered && !isActive && (
          <span className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-background/80 px-0.5 text-[9px] leading-none text-muted-foreground">
            {index + 1}
          </span>
        )}
      </span>
      <span className={`flex min-w-0 flex-col justify-center gap-0.5 truncate ${isActive ? "text-primary text-glow-sm" : "text-foreground"}`}>
        <span className="truncate">{track.title}</span>
        <span className="truncate text-[10px] text-muted-foreground sm:hidden">
          {track.artist} {track.album ? `/ ${track.album}` : ""}
        </span>
      </span>
      <span className={`hidden truncate sm:block ${isActive ? "text-primary" : "text-muted-foreground"}`}>{track.artist}</span>
      <span className="hidden truncate text-muted-foreground sm:block">{track.album}</span>
      <span className="hidden text-right text-muted-foreground sm:block">{fmt(track.duration)}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onLike()
        }}
        className={`text-base flex items-center justify-center transition-colors ${
          isLiked ? "text-primary text-glow-sm" : "text-muted-foreground hover:text-primary"
        }`}
        aria-label={isLiked ? "Unlike" : "Like"}
      >
        {isLiked ? "♥" : "♡"}
      </button>
    </div>
  )
}

function TrackList({
  tracks,
  loading,
  emptyText,
  onPlay,
  onLikeToggle,
  isLiked,
  currentTrackId,
  playlistSourceName = null,
  /** When set (e.g. home playlist/artist), use same art as homepage tiles; else per-track iTunes artwork */
  listThumbnailSrc = null,
  resolveThumbnailSrc,
}: {
  tracks: iTunesTrack[]
  loading: boolean
  emptyText: string
  onPlay: (track: iTunesTrack, queue: iTunesTrack[], source?: { playlistName: string }) => void
  onLikeToggle: (track: iTunesTrack) => void
  isLiked: (id: string) => boolean
  currentTrackId: string | null
  playlistSourceName?: string | null
  listThumbnailSrc?: string | null
  resolveThumbnailSrc?: (track: iTunesTrack) => string | null
}) {
  if (loading) {
    return <div className="px-4 py-6 text-xs font-mono text-muted-foreground">{"> "}loading?</div>
  }
  if (!tracks.length) {
    return <div className="px-4 py-6 text-xs font-mono text-muted-foreground">{"> "}{emptyText}</div>
  }
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_30px] gap-2 bg-card px-2 py-2 text-xs tracking-widest text-muted-foreground sm:grid-cols-[44px_minmax(0,1fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_60px_30px] sm:px-4">
        <span className="sr-only">ART</span>
        <span>TRACK</span>
        <span className="hidden sm:block">ARTIST</span>
        <span className="hidden sm:block">ALBUM</span>
        <span className="hidden text-right sm:block">TIME</span>
        <span></span>
      </div>
      {tracks.map((t, i) => (
        <TrackRow
          key={`${t.id}-${i}`}
          index={i}
          track={t}
          thumbnailSrc={
            listThumbnailSrc ||
            resolveThumbnailSrc?.(t) ||
            playbackArtworkUrl(t.artwork, null) ||
            "/favicon.png"
          }
          isActive={currentTrackId === t.id}
          isLiked={isLiked(t.id)}
          onPlay={() =>
            onPlay(
              t,
              tracks,
              playlistSourceName ? { playlistName: playlistSourceName } : undefined,
            )
          }
          onLike={() => onLikeToggle(listThumbnailSrc ? { ...t, artwork: listThumbnailSrc } : t)}
        />
      ))}
    </div>
  )
}

function CuratedPlaylistTile({
  name,
  caption,
  selected,
  onSelect,
  onPlay,
  disabled = false,
}: {
  name: string
  /** Shown on tile; defaults to `name` (use for featured charts: query + limit) */
  caption?: string
  selected: boolean
  onSelect: () => void
  onPlay?: () => void
  disabled?: boolean
}) {
  const label = caption ?? name
  const cover = CURATED_PLAYLIST_IMAGES[name] ?? "/favicon.png"
  return (
    <div
      className={`group relative aspect-square text-left font-mono focus-within:ring-2 focus-within:ring-primary ${HOME_GRID_PAPER} ${
        selected
          ? "ring-2 ring-primary bg-primary/10"
          : "bg-secondary/35 ring-1 ring-white/5 hover:ring-primary/50 hover:bg-secondary/50"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 block h-full w-full cursor-pointer"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`Open ${label}`}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm">
        <HomeWaveImage src={cover} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3">
        <div
          className={`text-[11px] leading-snug line-clamp-2 tracking-wide transition-colors ${
            selected ? "text-primary text-glow-sm" : "text-white group-hover:text-primary"
          }`}
        >
          {label}
        </div>
      </div>
      {onPlay && (
        <button
          type="button"
          className="absolute bottom-3 right-3 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-all hover:scale-105 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-0"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onPlay()
          }}
          aria-label={`Play ${label}`}
        >
          <span className="ml-0.5 block text-sm leading-none text-primary-foreground">&#9654;</span>
        </button>
      )}
    </div>
  )
}

function FeaturedChartsSection({
  activeName,
  onSelectPlaylist,
  onPlayPlaylist,
  selectionBusy = false,
}: {
  activeName: string | null
  onSelectPlaylist: (name: string) => void
  onPlayPlaylist: (name: string) => void
  selectionBusy?: boolean
}) {
  return (
    <div className="bg-card p-3 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="text-muted-foreground text-xs tracking-widest">{">"} FEATURED CHARTS</div>
        <div className="text-muted-foreground text-[11px] font-mono">LIVE SIGNAL</div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {FEATURED_CHART_NAMES.map((name) => (
          <CuratedPlaylistTile
            key={name}
            name={name}
            caption={getFeaturedChartDisplayLabel(name, DEFAULT_CURATED_FETCH_LIMIT)}
            selected={activeName === name}
            onSelect={() => onSelectPlaylist(name)}
            onPlay={() => onPlayPlaylist(name)}
            disabled={selectionBusy}
          />
        ))}
      </div>
    </div>
  )
}

function PopularArtistsSection({
  activeName,
  onSelectArtist,
  onPlayArtist,
  selectionBusy = false,
}: {
  activeName: string | null
  onSelectArtist: (artist: PopularArtist) => void
  onPlayArtist: (artist: PopularArtist) => void
  selectionBusy?: boolean
}) {
  return (
    <div className="bg-card p-3 sm:p-6">
      <div className="mb-4 text-xs tracking-widest text-muted-foreground">{">"} POPULAR ARTISTS</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
        {POPULAR_ARTISTS.map((artist) => (
          <div
            key={artist.name}
            className={`group min-w-0 text-left font-mono transition-opacity duration-200 ${
              selectionBusy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <div
              className={`relative aspect-square bg-secondary/35 ring-1 focus-within:ring-2 focus-within:ring-primary ${HOME_GRID_PAPER} ${
                activeName === artist.name ? "ring-primary" : "ring-white/5 hover:ring-primary/50"
              }`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 block h-full w-full cursor-pointer"
                onClick={() => onSelectArtist(artist)}
                disabled={selectionBusy}
                aria-label={`Open ${artist.name}`}
              />
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm">
                <HomeWaveImage src={artist.image} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              </div>
              <div className="pointer-events-none absolute left-3 top-3 text-[10px] text-primary/70">
                ARTIST.SIGNAL
              </div>
              <button
                type="button"
                className="absolute bottom-3 right-3 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-all hover:scale-105 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0"
                disabled={selectionBusy}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onPlayArtist(artist)
                }}
                aria-label={`Play ${artist.name}`}
              >
                <span className="ml-0.5 block text-sm leading-none text-primary-foreground">&#9654;</span>
              </button>
            </div>
            <div
              className={`mt-3 truncate text-sm leading-tight ${
                activeName === artist.name ? "text-primary text-glow-sm" : "text-muted-foreground group-hover:text-primary"
              }`}
            >
              {artist.name}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Artist</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const FOOTER_COLUMNS = [
  {
    title: "Company",
    links: ["About", "Jobs", "For the Record"],
  },
  {
    title: "Communities",
    links: ["For Artists", "Developers", "Advertising", "Investors", "Vendors"],
  },
  {
    title: "Useful links",
    links: ["Support", "Free Mobile App", "Popular by Country", "Import your music"],
  },
  {
    title: "Spotify Plans",
    links: ["Premium Individual", "Premium Duo", "Premium Family", "Premium Student", "Spotify Free"],
  },
]

const FOOTER_LEGAL_LINKS = [
  "Legal",
  "Safety & Privacy Center",
  "Privacy Policy",
  "Cookies",
  "About Ads",
  "Accessibility",
]

const FOOTER_SOCIAL_LINKS = [
  { label: "IG", name: "Instagram", href: "https://www.instagram.com/spotify/" },
  { label: "X", name: "X", href: "https://x.com/Spotify" },
  { label: "F", name: "Facebook", href: "https://www.facebook.com/Spotify" },
]

export function AppFooter() {
  return (
    <footer className="w-full flex-shrink-0 border-t border-primary/10 bg-card font-mono text-xs text-muted-foreground">
      <div className="px-4 py-4 sm:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-primary text-glow-sm">spotify.trm</div>
            <div className="mt-1 text-[11px] text-muted-foreground/80">© 2026</div>
          </div>
          <div className="flex gap-2">
            {FOOTER_SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Spotify on ${social.name}`}
                className="flex h-8 w-8 items-center justify-center bg-secondary text-[11px] text-primary hover:bg-primary hover:text-primary-foreground"
              >
                {social.label}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
          {["Legal", "Privacy", "Cookies"].map((link) => (
            <button key={link} type="button" className="hover:text-primary">
              {link}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden w-full px-4 py-5 sm:block sm:px-8 sm:py-6">
        <div className="grid gap-8 xl:grid-cols-[1fr_auto]">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title} className="space-y-3">
                <div className="text-primary text-glow-sm">{column.title}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  {column.links.map((link) => (
                    <button
                      key={link}
                      type="button"
                      className="hover:text-primary transition-colors text-left"
                    >
                      {link}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 xl:justify-end">
            {FOOTER_SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Spotify on ${social.name}`}
                className="h-9 w-9 shrink-0 bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <span className="flex h-full w-full items-center justify-center">{social.label}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-primary/15 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <button key={link} type="button" className="hover:text-primary transition-colors">
                {link}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-muted-foreground/80 text-[11px] tracking-wide">
            <span>© 2026 spotify.trm</span>
            <span className="text-muted-foreground/45" aria-hidden>
              ·
            </span>
            <span className="text-primary/85">elevenlabs</span>
            <span className="text-muted-foreground/45" aria-hidden>
              ·
            </span>
            <span>v0</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function AiDjConsole({
  autoDJ,
  isSpeaking,
  currentTrack,
  currentArtist,
  selectedHost,
  onSelectHost,
  onToggle,
}: {
  autoDJ: boolean
  isSpeaking: boolean
  currentTrack: string
  currentArtist: string
  selectedHost: number
  onSelectHost: (index: number) => void
  onToggle?: () => void
}) {
  const host = AI_DJ_HOSTS[selectedHost] ?? AI_DJ_HOSTS[0]
  const mouthVis = isSpeaking ? "opacity-100" : "opacity-0 pointer-events-none"
  const faceShellClass = [
    "terminal-face",
    "dj-viz-ambient",
    "dj-face-focus",
    autoDJ && !isSpeaking ? "dj-viz-armed" : "",
    isSpeaking ? "is-speaking" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <section className="ai-dj-screen bg-card/40 p-5 sm:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-primary/10 pb-5">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.35em] text-muted-foreground">broadcast</p>
            <h2
              className="mt-1 text-4xl font-black tracking-tighter text-primary sm:text-5xl lg:text-6xl"
              style={{ letterSpacing: "-0.045em" }}
            >
              AI DJ
            </h2>
            <p className="mt-2 max-w-lg text-base leading-snug text-muted-foreground">{host.line}</p>
          </div>
          <button
            type="button"
            onClick={() => onToggle?.()}
            className={`rounded-full border-2 px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-all sm:px-7 sm:text-sm sm:tracking-[0.18em] ${
              autoDJ
                ? "border-primary bg-primary text-primary-foreground shadow-[0_0_28px_color-mix(in_oklab,var(--primary)_38%,transparent)]"
                : "border-primary/30 text-primary hover:border-primary hover:bg-primary/10"
            }`}
          >
            {autoDJ ? "Live" : "Click here to start"}
          </button>
        </header>

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="relative w-full min-w-0 flex-1 lg:max-w-xl">
            <div
              className={`${faceShellClass} min-h-[min(58vh,460px)] rounded-sm sm:min-h-[min(62vh,500px)] md:min-h-[min(64vh,540px)]`}
            >
              <div className="face-scanline" />
              <img
                src={host.image}
                alt={host.name}
                className="dj-character-img theme-tint-art"
                draggable={false}
              />
              <div className="dj-status-strip">
                <span className="font-mono">{autoDJ ? "TX" : "RX"}</span>
                <span>{isSpeaking ? "VOICE" : autoDJ ? "SCAN" : "IDLE"}</span>
              </div>
              <div
                className={`face-mouth transition-opacity duration-300 ${mouthVis}`}
                aria-hidden={!isSpeaking}
                aria-label={isSpeaking ? "AI DJ lipsync active" : undefined}
              >
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} style={{ animationDelay: `${i * 45}ms` }} />
                ))}
              </div>
              <div className="dj-live-visualizer" aria-hidden="true">
                {Array.from({ length: 28 }).map((_, i) => (
                  <span key={i} style={{ animationDelay: `${i * 28}ms` }} />
                ))}
              </div>
              <div className="dj-signal-ring" />
              <div className="face-caption">
                <span className="font-semibold text-primary">{host.name}</span>
                <span className="uppercase tracking-wider">{isSpeaking ? "on air" : host.vibe}</span>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <div>
              <p className="mb-8 text-[11px] uppercase tracking-[0.28em] text-muted-foreground sm:mb-9">
                pick host
              </p>
              <div className="no-scrollbar flex items-end justify-start gap-2.5 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible md:gap-3">
                {AI_DJ_HOSTS.map((dj, i) => {
                  const active = selectedHost === i
                  return (
                    <button
                      key={dj.name}
                      type="button"
                      onClick={() => onSelectHost(i)}
                      aria-pressed={active}
                      aria-label={`Select ${dj.name}`}
                      className={`shrink-0 origin-bottom rounded-lg border bg-background/60 text-left transition-all duration-300 ease-out ${
                        active
                          ? "z-10 w-[7.5rem] scale-[1.12] border-primary shadow-[0_16px_48px_-10px_color-mix(in_oklab,var(--primary)_32%,transparent)] sm:w-36 md:w-40"
                          : "w-16 border-primary/15 opacity-80 hover:scale-105 hover:border-primary/40 hover:opacity-100 sm:w-[4.75rem] md:w-20"
                      }`}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-t-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={dj.image} alt="" className="theme-tint-art h-full w-full object-cover" />
                        {active ? (
                          <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
                        ) : null}
                      </div>
                      <div className={`px-2 py-2 ${active ? "bg-primary/10" : ""}`}>
                        <div
                          className={`truncate font-mono font-bold leading-tight ${active ? "text-xs text-primary" : "text-[10px] text-muted-foreground sm:text-[11px]"}`}
                        >
                          {dj.name.replace(/^DJ\s/, "")}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2.5 border-l-2 border-primary/40 pl-5">
              <p className="font-mono text-sm text-primary">{host.voice}</p>
              <p className="text-xs text-muted-foreground sm:text-[13px]">{host.specialty}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {host.traits.map((trait) => (
                  <span key={trait} className="rounded-full border border-primary/20 px-2.5 py-1 text-[11px] text-muted-foreground">
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-primary/25 bg-background/50 px-4 py-3.5 font-mono text-base leading-snug sm:px-5 sm:py-4">
              <span className="text-primary">{currentTrack || "—"}</span>
              <span className="mx-2 text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">{currentArtist || "queue idle"}</span>
            </div>

            {(isSpeaking || !autoDJ) && (
              <p className="font-mono text-sm leading-relaxed text-primary/90">
                {isSpeaking ? (
                  <span className="animate-pulse">carrier locked — elevenlabs</span>
                ) : (
                  <>when you are ready, hit start — link-mix, no dead air between tracks</>
                )}
                <span className="cursor-blink">_</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function MainContent({
  activeNav = "1",
  vibeMode = false,
  onVibeModeChange,
  onSearchCommand,
  onTrackPlay,
  onLikeToggle,
  isLiked,
  currentTrackId,
  recentlyPlayed,
  likedTracksList,
  selectedPlaylist = null,
  onClearSelectedPlaylist,
  autoDJ = false,
  onAutoDjToggle,
  aiDjHostIndex = 0,
  onAiDjHostIndexChange,
  isSpeaking = false,
  currentTrack = "",
  currentArtist = "",
  commandLogs = [],
  onTerminalCommand,
  terminalProcessing = false,
  onTerminalFocusChange,
  terminalRef,
  sidebarArtistPick = null,
  onSidebarArtistPickHandled,
  onHomeSelectionBusyChange,
  searchPending = false,
}: {
  activeNav?: string
  vibeMode?: boolean
  onVibeModeChange?: (next: boolean) => void
  /** iTunes search in flight (home search bar → `search` command) */
  searchPending?: boolean
  onSearchCommand?: (query: string) => void
  onTrackPlay: (track: iTunesTrack, queue: iTunesTrack[], source?: { playlistName: string }) => void
  onLikeToggle: (track: iTunesTrack) => void
  isLiked: (id: string) => boolean
  currentTrackId: string | null
  recentlyPlayed: iTunesTrack[]
  likedTracksList: iTunesTrack[]
  selectedPlaylist?: string | null
  onClearSelectedPlaylist?: () => void
  /** From sidebar popular-artist click; `id` bumps so repeat picks same artist still apply */
  sidebarArtistPick?: { query: string; id: number } | null
  onSidebarArtistPickHandled?: () => void
  /** True while a home playlist/artist list is loading — parent can disable sidebar picks. */
  onHomeSelectionBusyChange?: (busy: boolean) => void
  autoDJ?: boolean
  onAutoDjToggle?: () => void
  /** Selected AI DJ host (0–3); synced with parent for ElevenLabs voice */
  aiDjHostIndex?: number
  onAiDjHostIndexChange?: (index: number) => void
  isSpeaking?: boolean
  currentTrack?: string
  currentArtist?: string
  commandLogs?: CommandLog[]
  onTerminalCommand?: (input: string) => void
  terminalProcessing?: boolean
  onTerminalFocusChange?: (focused: boolean) => void
  terminalRef?: RefObject<TerminalHandle | null>
}) {
  const [search, setSearch] = useState("")

  const [activePlaylist, setActivePlaylist] = useState<string | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<iTunesTrack[]>([])
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const homePlayingSectionRef = useRef<HTMLElement | null>(null)

  // Scroll the Home pane to the open playlist / artist track list (e.g. after sidebar pick)
  useEffect(() => {
    if (activeNav !== "1" || !activePlaylist) return
    const id = requestAnimationFrame(() => {
      homePlayingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
    return () => cancelAnimationFrame(id)
  }, [activePlaylist, activeNav])

  useEffect(() => {
    onHomeSelectionBusyChange?.(playlistLoading)
  }, [playlistLoading, onHomeSelectionBusyChange])

  // Auto-load when parent pushes a selectedPlaylist (e.g. from sidebar click)
  useEffect(() => {
    if (selectedPlaylist && selectedPlaylist !== activePlaylist) {
      setActivePlaylist(selectedPlaylist)
      setPlaylistTracks([])
      setPlaylistLoading(true)
      getCuratedPlaylist(selectedPlaylist, DEFAULT_CURATED_FETCH_LIMIT)
        .then(setPlaylistTracks)
        .finally(() => setPlaylistLoading(false))
    }
  }, [selectedPlaylist, activePlaylist])

  const loadPlaylist = (name: string) => {
    if (playlistLoading) return
    setActivePlaylist(name)
    setPlaylistTracks([])
    setPlaylistLoading(true)
    getCuratedPlaylist(name, DEFAULT_CURATED_FETCH_LIMIT)
      .then(setPlaylistTracks)
      .finally(() => setPlaylistLoading(false))
  }

  const loadArtist = (artist: PopularArtist) => {
    if (playlistLoading) return
    setActivePlaylist(artist.name)
    setPlaylistTracks([])
    setPlaylistLoading(true)
    searchITunes(artist.query, { limit: 15 })
      .then(setPlaylistTracks)
      .finally(() => setPlaylistLoading(false))
  }

  const playPlaylistFirst = useCallback(
    async (name: string) => {
      if (playlistLoading) return
      const tracks = await getCuratedPlaylist(name, DEFAULT_CURATED_FETCH_LIMIT)
      if (tracks.length > 0) {
        onTrackPlay(tracks[0], tracks, { playlistName: name })
      }
    },
    [onTrackPlay, playlistLoading],
  )

  const playArtistFirst = useCallback(
    async (artist: PopularArtist) => {
      if (playlistLoading) return
      const tracks = await searchITunes(artist.query, { limit: 15 })
      if (tracks.length > 0) {
        onTrackPlay(tracks[0], tracks, { playlistName: artist.name })
      }
    },
    [onTrackPlay, playlistLoading],
  )

  useEffect(() => {
    if (!sidebarArtistPick) return
    const artist = POPULAR_ARTISTS.find((a) => a.query === sidebarArtistPick.query)
    if (artist) loadArtist(artist)
    onSidebarArtistPickHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per sidebar pick (id)
  }, [sidebarArtistPick?.id])

  const clearPlaylistDetail = () => {
    setActivePlaylist(null)
    setPlaylistTracks([])
    onClearSelectedPlaylist?.()
  }

  /** Full curated list on Home; search box does not filter until Enter (handled via onSearchCommand only). */
  const curatedKeysFiltered = useMemo(
    () => Object.keys(CURATED_PLAYLISTS).filter((k) => !FEATURED_CHART_NAME_SET.has(k)),
    [],
  )

  /** Same cover as homepage tile / “playing from” header for the open list */
  const activeListThumbnailSrc = useMemo(() => {
    if (!activePlaylist) return null
    return (
      CURATED_PLAYLIST_IMAGES[activePlaylist] ??
      POPULAR_ARTISTS.find((a) => a.name === activePlaylist)?.image ??
      null
    )
  }, [activePlaylist])

  const renderNavContent = () => {
    switch (activeNav) {
      case "2": // YOUR LIBRARY
        return (
          <section className="space-y-4">
            <div className="bg-card p-6 space-y-3">
              <div className="text-muted-foreground text-xs tracking-widest">{">"} LIKED TRACKS</div>
              <TrackList
                tracks={likedTracksList}
                loading={false}
                emptyText="no liked tracks yet. tap ♡ on any track to add."
                onPlay={onTrackPlay}
                onLikeToggle={onLikeToggle}
                isLiked={isLiked}
                currentTrackId={currentTrackId}
                resolveThumbnailSrc={resolveHomeStyleTrackArt}
              />
            </div>
            <div className="bg-card p-6 space-y-3">
              <div className="text-muted-foreground text-xs tracking-widest">{">"} RECENTLY PLAYED</div>
              <TrackList
                tracks={recentlyPlayed}
                loading={false}
                emptyText="no recently played tracks. play a track to populate this list."
                onPlay={onTrackPlay}
                onLikeToggle={onLikeToggle}
                isLiked={isLiked}
                currentTrackId={currentTrackId}
                resolveThumbnailSrc={resolveHomeStyleTrackArt}
              />
            </div>
          </section>
        )

      case "4": // AI DJ
        return (
          <AiDjConsole
            autoDJ={autoDJ}
            isSpeaking={isSpeaking}
            currentTrack={currentTrack}
            currentArtist={currentArtist}
            selectedHost={aiDjHostIndex}
            onSelectHost={(i) => onAiDjHostIndexChange?.(i)}
            onToggle={onAutoDjToggle}
          />
        )

      case "3": // TERMINAL MUSIC — full CLI (same as former right dock)
        if (!terminalRef || !onTerminalCommand) {
          return (
            <section className="bg-card p-6 text-muted-foreground text-xs">
              {"> "}terminal unavailable
            </section>
          )
        }
        return (
          <section className="flex flex-col flex-1 min-h-0">
            <DockedTerminal
              variant="panel"
              ref={terminalRef}
              logs={commandLogs}
              onCommand={onTerminalCommand}
              isInputDisabled={terminalProcessing}
              onFocusChange={onTerminalFocusChange}
            />
          </section>
        )

      case "5": // HELP
        return (
          <section className="bg-card p-6">
            <div className="text-muted-foreground text-xs tracking-widest mb-1">{">"} HELP</div>
            <div className="text-primary text-sm font-mono mb-4">Keyboard shortcuts and commands</div>
            <div className="grid grid-cols-2 gap-6 text-xs font-mono">
              <div className="space-y-1 text-muted-foreground">
                <div className="text-primary mb-2">NAVIGATION</div>
                <div>
                  <span className="text-primary">[1-5]</span> - Home, Library, Terminal, AI DJ, Help (account {"&"} settings: sidebar @handle)
                </div>
                <div><span className="text-primary">[J/K]</span> - Select track up/down</div>
                <div><span className="text-primary">[Enter]</span> - Play selected track</div>
                <div><span className="text-primary">[/]</span> - Focus terminal</div>
                <div><span className="text-primary">[Esc]</span> - Unfocus terminal</div>
                <div><span className="text-primary">[?]</span> - Show all shortcuts</div>
              </div>
              <div className="space-y-1 text-muted-foreground">
                <div className="text-primary mb-2">PLAYBACK</div>
                <div><span className="text-primary">[Space]</span> - Play/Pause</div>
                <div><span className="text-primary">[N]</span> - Next track</div>
                <div><span className="text-primary">[P]</span> - Previous track</div>
                <div><span className="text-primary">[←/→]</span> - Seek -/+ 5s</div>
                <div><span className="text-primary">[↑/↓]</span> - Volume +/- 5%</div>
                <div><span className="text-primary">[M]</span> - Mute/Unmute</div>
              </div>
            </div>
            <div className="mt-4 pt-4">
              <div className="text-muted-foreground text-xs tracking-widest mb-3">{">"} TERMINAL COMMANDS</div>
              <div className="text-xs font-mono space-y-1 text-muted-foreground">
                <div><span className="text-primary">search [query]</span> - Search iTunes for music</div>
                <div><span className="text-primary">play [number]</span> - Play a track from results</div>
                <div><span className="text-primary">pause / resume</span> - Control playback</div>
                <div><span className="text-primary">skip / prev</span> - Navigate tracks</div>
                <div><span className="text-primary">volume [0-100]</span> - Set volume</div>
                <div><span className="text-primary">clear / help</span> - Terminal utilities</div>
              </div>
            </div>
          </section>
        )

      default:
        return null
    }
  }

  const contentShell =
    activeNav === "3"
      ? "flex flex-1 flex-col p-3 sm:p-5 lg:p-8"
      : "flex-1 p-3 sm:p-5 lg:p-8 space-y-4 sm:space-y-6"

  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col bg-background">
      {/* Search — same label rhythm as right pane (&gt; NOW PLAYING), no framed strip */}
      <div className="flex-shrink-0 bg-background px-3 pb-2 pt-3 sm:px-4 sm:pt-6 lg:pt-8">
        <div
          className={`flex min-w-0 flex-wrap items-center gap-2 rounded-sm py-0.5 transition-colors sm:flex-nowrap sm:gap-3 ${
            searchPending ? "ring-1 ring-primary/35 bg-primary/5" : ""
          }`}
        >
          <span className="text-muted-foreground text-xs tracking-widest shrink-0">
            {'>'} SEARCH
          </span>
          <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
            user@spotify:~$
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim() && onSearchCommand && !searchPending) {
                onSearchCommand(search.trim())
                setSearch("")
              }
            }}
            disabled={searchPending}
            placeholder="search [artist/song] + Enter"
            aria-busy={searchPending}
            className="min-w-[170px] flex-1 bg-transparent font-mono text-xs text-primary outline-none caret-primary placeholder:text-muted-foreground disabled:cursor-wait disabled:opacity-80"
          />
          {searchPending ? (
            <span className="text-primary text-xs font-mono shrink-0 animate-pulse tabular-nums pr-1">
              {"> "}querying iTunes…
            </span>
          ) : (
            <span className="cursor-blink text-primary text-xs shrink-0">|</span>
          )}
          {onVibeModeChange && (
            <div className="flex w-full shrink-0 items-center gap-2 border-primary/20 pt-2 sm:ml-auto sm:w-auto sm:gap-3 sm:border-l sm:pl-5 sm:pt-0">
              <span className="text-muted-foreground text-[10px] tracking-widest max-sm:hidden">THEME</span>
              <button
                type="button"
                onClick={() => onVibeModeChange(false)}
                className={`rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wide transition-colors ${
                  !vibeMode
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                Terminal
              </button>
              <button
                type="button"
                onClick={() => onVibeModeChange(true)}
                className={`rounded border px-2 py-1 text-[10px] font-mono uppercase tracking-wide transition-colors ${
                  vibeMode
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                Party
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={contentShell}>
        {activeNav !== "1" && renderNavContent()}

        {activeNav === "1" && (
          <>
            <section className="bg-card p-3 sm:p-6">
              <div className="mb-4 text-xs tracking-widest text-muted-foreground">{">"} CURATED PLAYLISTS</div>
              {curatedKeysFiltered.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground py-8">{"> "}no playlists match this filter.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {curatedKeysFiltered.map((pl) => (
                    <CuratedPlaylistTile
                      key={pl}
                      name={pl}
                      selected={activePlaylist === pl}
                      onSelect={() => loadPlaylist(pl)}
                      onPlay={() => void playPlaylistFirst(pl)}
                      disabled={playlistLoading}
                    />
                  ))}
                </div>
              )}
            </section>

            <PopularArtistsSection
              activeName={activePlaylist}
              onSelectArtist={loadArtist}
              onPlayArtist={(artist) => void playArtistFirst(artist)}
              selectionBusy={playlistLoading}
            />

            <FeaturedChartsSection
              activeName={activePlaylist}
              onSelectPlaylist={loadPlaylist}
              onPlayPlaylist={(name) => void playPlaylistFirst(name)}
              selectionBusy={playlistLoading}
            />

            {activePlaylist && (
              <section ref={homePlayingSectionRef} className="space-y-3 bg-card p-3 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-muted-foreground text-xs tracking-widest">
                    {">"} PLAYING FROM{" "}
                    <span className="text-primary">
                      {getPlaylistDisplayLabel(activePlaylist, DEFAULT_CURATED_FETCH_LIMIT)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearPlaylistDetail}
                    className="text-[11px] font-mono px-3 py-1 text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                  >
                    CLOSE LIST
                  </button>
                </div>
                <div className="flex items-center gap-3 bg-background p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getCuratedPlaylistCover(activePlaylist) ?? "/favicon.png"}
                    alt=""
                    className="theme-tint-art h-20 w-20 flex-shrink-0 object-cover sm:h-28 sm:w-28"
                  />
                  <div className="min-w-0">
                    <div className="text-primary text-sm font-mono truncate">
                      {getPlaylistDisplayLabel(activePlaylist, DEFAULT_CURATED_FETCH_LIMIT)}
                    </div>
                    <div className="text-muted-foreground text-xs truncate">curated playlist — tap a row to play</div>
                  </div>
                </div>
                <TrackList
                  tracks={playlistTracks}
                  loading={playlistLoading}
                  emptyText="no tracks in this playlist."
                  onPlay={onTrackPlay}
                  onLikeToggle={onLikeToggle}
                  isLiked={isLiked}
                  currentTrackId={currentTrackId}
                  playlistSourceName={activePlaylist}
                  listThumbnailSrc={activeListThumbnailSrc}
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
