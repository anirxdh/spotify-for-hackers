"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import {
  searchITunes,
  getCuratedPlaylist,
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
import DockedTerminal from "@/components/spotify/DockedTerminal"
import type { TerminalHandle } from "@/components/spotify/Terminal"

const fmt = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

interface TrackRowProps {
  index: number
  track: iTunesTrack
  isActive: boolean
  isLiked: boolean
  onPlay: () => void
  onLike: () => void
}

function TrackRow({ index, track, isActive, isLiked, onPlay, onLike }: TrackRowProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPlay}
      className={`grid grid-cols-[40px_1fr_1fr_1fr_60px_30px] gap-2 px-4 py-2 cursor-pointer transition-all duration-150 text-xs font-mono ${
        isActive ? "bg-accent text-primary row-active" : hovered ? "bg-secondary" : ""
      }`}
    >
      <span className="flex items-center text-muted-foreground">
        {hovered || isActive ? (
          <span className={`text-primary ${isActive ? "text-glow-sm" : ""}`}>&#9654;</span>
        ) : (
          <span>[{index + 1}]</span>
        )}
      </span>
      <span className={`flex items-center gap-1.5 truncate ${isActive ? "text-primary text-glow-sm" : "text-foreground"}`}>
        <span className="truncate">{track.title}</span>
      </span>
      <span className={`truncate ${isActive ? "text-primary" : "text-muted-foreground"}`}>{track.artist}</span>
      <span className="text-muted-foreground truncate">{track.album}</span>
      <span className="text-muted-foreground text-right">{fmt(track.duration)}</span>
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
}: {
  tracks: iTunesTrack[]
  loading: boolean
  emptyText: string
  onPlay: (track: iTunesTrack, queue: iTunesTrack[], source?: { playlistName: string }) => void
  onLikeToggle: (track: iTunesTrack) => void
  isLiked: (id: string) => boolean
  currentTrackId: string | null
  playlistSourceName?: string | null
}) {
  if (loading) {
    return <div className="px-4 py-6 text-xs font-mono text-muted-foreground">{"> "}loading?</div>
  }
  if (!tracks.length) {
    return <div className="px-4 py-6 text-xs font-mono text-muted-foreground">{"> "}{emptyText}</div>
  }
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[40px_1fr_1fr_1fr_60px_30px] gap-2 px-4 py-2 bg-card text-xs text-muted-foreground tracking-widest">
        <span></span>
        <span>TRACK</span>
        <span>ARTIST</span>
        <span>ALBUM</span>
        <span className="text-right">TIME</span>
        <span></span>
      </div>
      {tracks.map((t, i) => (
        <TrackRow
          key={`${t.id}-${i}`}
          index={i}
          track={t}
          isActive={currentTrackId === t.id}
          isLiked={isLiked(t.id)}
          onPlay={() =>
            onPlay(
              t,
              tracks,
              playlistSourceName ? { playlistName: playlistSourceName } : undefined,
            )
          }
          onLike={() => onLikeToggle(t)}
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
      className={`group relative aspect-square overflow-hidden text-left font-mono transition-all duration-200 focus-within:ring-2 focus-within:ring-primary ${
        selected
          ? "ring-2 ring-primary bg-primary/10"
          : "bg-secondary/35 ring-1 ring-white/5 group-hover:ring-primary/50 group-hover:bg-secondary/50 group-hover:shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 block h-full w-full cursor-pointer"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`Open ${label}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04] group-hover:brightness-110"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
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
    <div className="bg-card p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="text-muted-foreground text-xs tracking-widest">{">"} FEATURED CHARTS</div>
        <div className="text-muted-foreground text-[11px] font-mono">LIVE SIGNAL</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
    <div className="bg-card p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="text-muted-foreground text-xs tracking-widest">{">"} POPULAR ARTISTS</div>
        <div className="text-muted-foreground text-[11px] font-mono">SHOW ALL</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {POPULAR_ARTISTS.map((artist) => (
          <div
            key={artist.name}
            className={`group min-w-0 text-left font-mono transition-opacity duration-200 ${
              selectionBusy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <div
              className={`relative aspect-square overflow-hidden bg-secondary/35 ring-1 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary ${
                activeName === artist.name ? "ring-primary" : "ring-white/5 group-hover:ring-primary/50"
              }`}
            >
              <button
                type="button"
                className="absolute inset-0 z-0 block h-full w-full cursor-pointer"
                onClick={() => onSelectArtist(artist)}
                disabled={selectionBusy}
                aria-label={`Open ${artist.name}`}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artist.image}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04] group-hover:brightness-110"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
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
    <footer className="bg-card p-6 font-mono text-xs text-muted-foreground">
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

      <div className="mt-8 pt-6 border-t border-primary/15 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
    </footer>
  )
}

function AiDjConsole({
  autoDJ,
  isSpeaking,
  currentTrack,
  currentArtist,
  onToggle,
}: {
  autoDJ: boolean
  isSpeaking: boolean
  currentTrack: string
  currentArtist: string
  onToggle?: () => void
}) {
  /** Lipsync + bar visualizer only while TTS is active; idle shows character only */
  const visClass = isSpeaking ? "opacity-100" : "opacity-0 pointer-events-none"

  return (
    <section className="bg-card p-6 space-y-5 ai-dj-screen">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-muted-foreground text-xs tracking-widest">{">"} AI DJ CONTROL ROOM</div>
          <div className="text-primary text-2xl font-mono font-bold text-glow mt-1">SYS.DJ LIVE HOST</div>
        </div>
        <button
          onClick={() => onToggle?.()}
          className={`px-4 py-2 text-xs font-mono transition-colors ${
            autoDJ
              ? "bg-primary text-primary-foreground"
              : "bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {autoDJ ? "DISENGAGE" : "ENGAGE"}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(340px,540px)_1fr] gap-5">
        <div className={`terminal-face ${isSpeaking ? "is-speaking" : ""}`}>
          <div className="face-scanline" />
          <img
            src="/ai-dj-character.png"
            alt=""
            className="dj-character-img"
            draggable={false}
          />
          <div className="dj-status-strip">
            <span>{autoDJ ? "BROADCASTING" : "MIC ARMED"}</span>
            <span>{isSpeaking ? "VOICE OUT" : "STANDBY"}</span>
          </div>
          <div
            className={`face-mouth transition-opacity duration-300 ${visClass}`}
            aria-hidden={!isSpeaking}
            aria-label={isSpeaking ? "AI DJ lipsync active" : undefined}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 45}ms` }} />
            ))}
          </div>
          <div className={`dj-live-visualizer transition-opacity duration-300 ${visClass}`} aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 34}ms` }} />
            ))}
          </div>
          <div className="dj-signal-ring" />
          <div className="face-caption">
            <span>{autoDJ ? "LIVE MIX BUS" : "STANDBY"}</span>
            <span>{isSpeaking ? "ELEVENLABS TX" : "GROQ READY"}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-background p-4">
            <div className="text-muted-foreground text-xs tracking-widest mb-2">{">"} CURRENT SIGNAL</div>
            <div className="text-primary text-lg font-mono text-glow-sm truncate">
              {currentTrack || "no track loaded"}
            </div>
            <div className="text-muted-foreground text-xs truncate">
              {currentArtist || "search music or engage AI DJ to load a queue"}
            </div>
          </div>

          <div className="bg-background p-4 min-h-[128px]">
            <div className="text-muted-foreground text-xs tracking-widest mb-2">{">"} DJ MIC</div>
            <div className="text-primary text-sm font-mono leading-relaxed text-glow-sm">
              {isSpeaking ? (
                <span className="inline-block animate-pulse">LIVE TX — carrier locked</span>
              ) : autoDJ ? (
                "listening for the next transition..."
              ) : (
                "sudo auto dj arms the live mix."
              )}
              <span className="cursor-blink">_</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="bg-background p-3">
              <div className="text-muted-foreground">VOICE</div>
              <div className="text-primary mt-1">ELEVENLABS</div>
            </div>
            <div className="bg-background p-3">
              <div className="text-muted-foreground">BRAIN</div>
              <div className="text-primary mt-1">GROQ</div>
            </div>
            <div className="bg-background p-3">
              <div className="text-muted-foreground">MODE</div>
              <div className="text-primary mt-1">{autoDJ ? "ON AIR" : "READY"}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function MainContent({
  activeNav = "1",
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
      ? "flex flex-1 flex-col min-h-0 overflow-hidden p-8"
      : "flex-1 min-h-0 overflow-auto p-8 space-y-6"

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden bg-background">
      {/* Search — same label rhythm as right pane (&gt; NOW PLAYING), no framed strip */}
      <div className="flex-shrink-0 px-4 pt-8 pb-2 bg-background">
        <div
          className={`flex flex-nowrap items-center gap-3 min-w-0 rounded-sm py-0.5 transition-colors ${
            searchPending ? "ring-1 ring-primary/35 bg-primary/5" : ""
          }`}
        >
          <span className="text-muted-foreground text-xs tracking-widest shrink-0">
            {'>'} SEARCH
          </span>
          <span className="text-muted-foreground text-xs font-mono shrink-0">
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
            className="flex-1 min-w-0 bg-transparent text-primary text-xs font-mono outline-none placeholder:text-muted-foreground caret-primary disabled:cursor-wait disabled:opacity-80"
          />
          {searchPending ? (
            <span className="text-primary text-xs font-mono shrink-0 animate-pulse tabular-nums pr-1">
              {"> "}querying iTunes…
            </span>
          ) : (
            <span className="cursor-blink text-primary text-xs shrink-0">|</span>
          )}
        </div>
      </div>

      <div className={contentShell}>
        {activeNav !== "1" && renderNavContent()}

        {activeNav === "1" && (
          <>
            <section className="bg-card p-6">
              <div className="text-muted-foreground text-xs tracking-widest mb-4">{">"} CURATED PLAYLISTS</div>
              {curatedKeysFiltered.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground py-8">{"> "}no playlists match this filter.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
              <section ref={homePlayingSectionRef} className="bg-card p-6 space-y-3">
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
                <div className="bg-background p-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      CURATED_PLAYLIST_IMAGES[activePlaylist] ??
                      POPULAR_ARTISTS.find((artist) => artist.name === activePlaylist)?.image ??
                      "/favicon.png"
                    }
                    alt=""
                    className="w-28 h-28 object-cover flex-shrink-0"
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
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
