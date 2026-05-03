"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_CURATED_FETCH_LIMIT,
  FEATURED_CHART_NAMES,
  getFeaturedChartDisplayLabel,
} from "@/lib/itunesService"
import type { PopularArtist } from "@/lib/discovery"
import { POPULAR_ARTISTS } from "@/lib/discovery"

const ACCOUNT_HANDLE_KEY = "play-sh-account-handle"
const ACCOUNT_AVATAR_KEY = "play-sh-account-avatar"
const DEFAULT_HANDLE = "guest"

type AudioQuality = "LOW" | "MEDIUM" | "HIGH"
type Equalizer = "FLAT" | "BASS" | "TREBLE" | "VOCAL"

const AUDIO_ORDER: AudioQuality[] = ["LOW", "MEDIUM", "HIGH"]
const EQ_ORDER: Equalizer[] = ["FLAT", "BASS", "TREBLE", "VOCAL"]

const avatarOptions = [
  { id: "female-dj", label: "DJ", src: "/avatar-female-dj.png" },
  { id: "male-hacker", label: "Hacker", src: "/avatar-male-hacker.png" },
  { id: "female-engineer", label: "Engineer", src: "/avatar-female-engineer.png" },
  { id: "male-listener", label: "Listener", src: "/avatar-male-listener.png" },
]

const navItems = [
  { key: "1", label: "HOME" },
  { key: "2", label: "YOUR LIBRARY" },
  { key: "3", label: "TERMINAL MUSIC" },
  { key: "4", label: "AI DJ" },
  { key: "5", label: "HELP" },
]

const playlists = [
  "This Is The Weeknd",
  "Lo-Fi Beats",
  "Cyberpunk 2077 Radio",
  "Night Drive",
  "Focus Mode",
]

export default function Sidebar({
  activeNav,
  selectedPlaylist,
  selectionBusy = false,
  onNavChange,
  onPlaylistSelect,
  onFeaturedChartSelect,
  onPopularArtistSelect,
  vibeMode = false,
  onVibeModeChange,
  audioQuality = "HIGH",
  onAudioQualityChange,
  equalizer = "FLAT",
  onEqualizerChange,
  aiVoiceEnabled = true,
  onAiVoiceToggle,
}: {
  activeNav: string
  selectedPlaylist?: string | null
  /** Home pane is loading a playlist/artist list — block duplicate picks across sidebar groups */
  selectionBusy?: boolean
  onNavChange: (k: string) => void
  onPlaylistSelect?: (name: string) => void
  onFeaturedChartSelect?: (chartName: string) => void
  onPopularArtistSelect?: (artist: PopularArtist) => void
  vibeMode?: boolean
  onVibeModeChange?: (next: boolean) => void
  audioQuality?: AudioQuality
  onAudioQualityChange?: (q: AudioQuality) => void
  equalizer?: Equalizer
  onEqualizerChange?: (eq: Equalizer) => void
  aiVoiceEnabled?: boolean
  onAiVoiceToggle?: () => void
}) {
  const [handle, setHandle] = useState(DEFAULT_HANDLE)
  const [avatarId, setAvatarId] = useState(avatarOptions[0].id)
  const [renameOpen, setRenameOpen] = useState(false)
  const [draft, setDraft] = useState(DEFAULT_HANDLE)
  const [draftAvatarId, setDraftAvatarId] = useState(avatarOptions[0].id)
  const selectedAvatar = avatarOptions.find((avatar) => avatar.id === avatarId) ?? avatarOptions[0]

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACCOUNT_HANDLE_KEY)
      if (stored && stored.trim()) setHandle(stored.trim())
      const storedAvatar = localStorage.getItem(ACCOUNT_AVATAR_KEY)
      if (storedAvatar && avatarOptions.some((avatar) => avatar.id === storedAvatar)) {
        setAvatarId(storedAvatar)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const openRename = useCallback(() => {
    setDraft(handle)
    setDraftAvatarId(avatarId)
    setRenameOpen(true)
  }, [avatarId, handle])

  const saveRename = useCallback(() => {
    const next = draft.trim() || DEFAULT_HANDLE
    setHandle(next)
    setAvatarId(draftAvatarId)
    try {
      localStorage.setItem(ACCOUNT_HANDLE_KEY, next)
      localStorage.setItem(ACCOUNT_AVATAR_KEY, draftAvatarId)
    } catch {
      /* ignore */
    }
    setRenameOpen(false)
  }, [draft, draftAvatarId])

  return (
    <aside className="flex flex-col h-full bg-background w-[260px] min-w-[260px] overflow-hidden">
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="vibe-party-dialog font-mono sm:max-w-md max-h-[90vh] overflow-y-auto border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-primary tracking-wide">
              {'>'} ACCOUNT {"&"} SETTINGS
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Display name, theme, audio, and avatar. Leave name blank to reset to guest.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="account-handle" className="text-xs text-muted-foreground">
              Display name
            </Label>
            <Input
              id="account-handle"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename()
              }}
              placeholder={DEFAULT_HANDLE}
              className="font-mono text-sm"
              autoComplete="username"
            />
            <p className="text-[11px] text-muted-foreground">
              Preview:{" "}
              <span className="text-primary">
                {(draft.trim() || DEFAULT_HANDLE).toLowerCase()}@spotify
              </span>
            </p>
            <div className="mt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Theme</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onVibeModeChange?.(false)}
                  className={`flex-1 rounded border px-2 py-2 text-[11px] font-mono transition-colors ${
                    !vibeMode
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  Terminal green
                </button>
                <button
                  type="button"
                  onClick={() => onVibeModeChange?.(true)}
                  className={`flex-1 rounded border px-2 py-2 text-[11px] font-mono transition-colors ${
                    vibeMode
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  Party mode
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Audio quality</Label>
              <button
                type="button"
                onClick={() => {
                  const next = AUDIO_ORDER[(AUDIO_ORDER.indexOf(audioQuality) + 1) % AUDIO_ORDER.length]
                  onAudioQualityChange?.(next)
                }}
                className="w-full rounded border border-border bg-background px-2 py-2 text-left text-[11px] font-mono text-primary transition-colors hover:bg-primary/10"
              >
                {audioQuality}{" "}
                {audioQuality === "HIGH" ? "(320kbps)" : audioQuality === "MEDIUM" ? "(160kbps)" : "(96kbps)"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Equalizer</Label>
              <button
                type="button"
                onClick={() => {
                  const next = EQ_ORDER[(EQ_ORDER.indexOf(equalizer) + 1) % EQ_ORDER.length]
                  onEqualizerChange?.(next)
                }}
                className="w-full rounded border border-border bg-background px-2 py-2 text-left text-[11px] font-mono text-primary transition-colors hover:bg-primary/10"
              >
                {equalizer}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">AI DJ voice</Label>
              <button
                type="button"
                onClick={() => onAiVoiceToggle?.()}
                className={`w-full rounded border px-2 py-2 text-left text-[11px] font-mono transition-colors ${
                  aiVoiceEnabled
                    ? "border-primary/40 bg-primary/15 text-primary text-glow-sm"
                    : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {aiVoiceEnabled ? "ENABLED" : "DISABLED"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Avatar</Label>
              <div className="grid grid-cols-4 gap-2">
                {avatarOptions.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setDraftAvatarId(avatar.id)}
                    className={`group space-y-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      draftAvatarId === avatar.id ? "text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <span
                      className={`block aspect-square overflow-hidden bg-background ring-1 transition-all ${
                        draftAvatarId === avatar.id
                          ? "ring-primary shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_50%,transparent)]"
                          : "ring-primary/20 group-hover:ring-primary/60 group-hover:shadow-[0_0_14px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatar.src}
                        alt=""
                        className="theme-tint-art h-full w-full object-cover brightness-125 contrast-125 saturate-150"
                      />
                    </span>
                    <span className="block truncate text-center text-[10px]">{avatar.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-mono"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="font-mono"
              onClick={saveRename}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logo + account */}
      <div className="px-6 pb-6 pt-8 flex items-center justify-between gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/favicon.png"
          alt=""
          className="h-[52px] w-[52px] shrink-0 object-contain drop-shadow-[0_0_14px_color-mix(in_oklab,var(--primary)_38%,transparent)]"
          style={{ imageRendering: "auto" }}
        />
        <button
          type="button"
          onClick={openRename}
          title="Edit profile"
          className="flex min-w-0 flex-1 items-center justify-end gap-2 border border-primary/25 bg-primary/5 p-2 text-right transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="w-8 h-8 shrink-0 bg-primary/10 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedAvatar.src}
              alt=""
              className="theme-tint-art h-full w-full object-cover brightness-125 contrast-125 saturate-150"
            />
          </span>
          <div className="flex flex-col min-w-0 text-right">
            <span className="block w-full text-primary text-[11px] font-mono truncate text-right">
              {handle.toLowerCase()}@spotify
            </span>
            <span className="text-muted-foreground text-[10px] tracking-wide">FREE PLAN</span>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <div className="p-5 pt-0">
        <div className="text-muted-foreground text-xs mb-2 tracking-widest">
          {'>'} NAVIGATION
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavChange(item.key)}
              className={`w-full text-left px-2 py-1.5 text-xs font-mono tracking-wide flex items-center gap-2 transition-all duration-150 ${
                activeNav === item.key
                  ? "bg-primary/20 text-primary"
                  : "text-primary hover:bg-accent hover:text-primary"
              }`}
            >
              <span className="text-muted-foreground opacity-70">
                [{item.key}]
              </span>
              <span className={activeNav === item.key ? "text-primary-foreground" : ""}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Playlists, popular artists, featured charts — same order as Home */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden pr-0.5">
          <div>
            <div className="text-muted-foreground mb-2 text-xs tracking-widest">
              {'>'} PLAYLISTS
            </div>
            <ul className="flex flex-col">
              {playlists.map((pl) => (
                <li key={pl}>
                  <button
                    type="button"
                    disabled={selectionBusy}
                    onClick={() => onPlaylistSelect?.(pl)}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-xs tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-40 disabled:cursor-wait ${
                      selectedPlaylist === pl
                        ? "bg-primary/15 text-primary text-glow-sm"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <span className="text-muted-foreground opacity-70">
                      {selectedPlaylist === pl ? "[*]" : "[-]"}
                    </span>
                    <span className="truncate">{pl}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-muted-foreground mb-2 text-xs tracking-widest">
              {'>'} POPULAR ARTISTS
            </div>
            <ul className="flex flex-col gap-1">
              {POPULAR_ARTISTS.map((artist) => (
                <li key={artist.query}>
                  <button
                    type="button"
                    disabled={selectionBusy}
                    onClick={() => onPopularArtistSelect?.(artist)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40 disabled:cursor-wait"
                  >
                    <span className="shrink-0 text-muted-foreground opacity-70">[-]</span>
                    <span className="min-w-0 truncate">{artist.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-muted-foreground mb-2 text-xs tracking-widest">
              {'>'} FEATURED CHARTS
            </div>
            <ul className="flex flex-col gap-1">
              {FEATURED_CHART_NAMES.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    disabled={selectionBusy}
                    onClick={() => onFeaturedChartSelect?.(name)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40 disabled:cursor-wait"
                  >
                    <span className="shrink-0 text-muted-foreground opacity-70">[-]</span>
                    <span className="min-w-0 truncate">
                      {getFeaturedChartDisplayLabel(name, DEFAULT_CURATED_FETCH_LIMIT)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  )
}
