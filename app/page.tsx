"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Sidebar from "@/components/spotify/Sidebar"
import MainContent, { AppFooter } from "@/components/spotify/MainContent"
import BottomPlayer from "@/components/spotify/BottomPlayer"
import { TerminalHandle } from "@/components/spotify/Terminal"
import NowPlaying from "@/components/spotify/NowPlaying"
import SplashScreen from "@/components/SplashScreen"
import { parseCommand, CommandLog, StateUpdates } from "@/lib/commandParser"
import {
  searchITunes,
  iTunesTrack,
  getCuratedPlaylistCover,
  getPlaylistDisplayLabel,
  DEFAULT_CURATED_FETCH_LIMIT,
} from "@/lib/itunesService"
import { mockTrackToLikedEntry, MOCK_LIKED_ID_PREFIX, tracks } from "@/lib/mockTracks"
import { getVoiceResponse, shouldTriggerVoice, VoiceContext } from "@/lib/voiceResponses"
import { speak, stopSpeech } from "@/lib/textToSpeech"
import { getElevenLabsStatus, VOICES } from "@/lib/elevenLabsService"

const DJ_SPEECH_CONFIG = {
  /** Required so `speak()` routes through `/api/tts` → ElevenLabs (see `lib/textToSpeech.ts`) */
  useElevenLabs: true,
  voiceId: VOICES.charlie,
  modelId: "eleven_v3",
  stability: 0.5,
  similarityBoost: 0.78,
  style: 0.38,
  speed: 1.03,
  useSpeakerBoost: true,
  delivery: "[warm, excited radio DJ]",
  /** If the API key is missing or the request fails, still hear DJ lines via Web Speech */
  fallbackToBrowser: true,
  rate: 1.02,
  pitch: 1,
  volume: 1,
}

const SILENT_AUDIO_UNLOCK =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA=="

const VIBE_MODE_KEY = "play-sh-vibe-mode"
const LIKED_TRACKS_STORAGE_KEY = "play-sh-liked-tracks"

export default function SpotifyTerminal() {
  const [activeNav, setActiveNav] = useState("1")
  const [activeTrack, setActiveTrack] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(70)
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [autoDJ, setAutoDJ] = useState(false)
  const [vibeMode, setVibeMode] = useState(false)
  const [searchResults, setSearchResults] = useState<iTunesTrack[]>([])
  const [currentAudioTrack, setCurrentAudioTrack] = useState<iTunesTrack | null>(null)
  const [trackDuration, setTrackDuration] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const terminalRef = useRef<TerminalHandle>(null)
  const [, setTerminalFocused] = useState(false)
  const [isShuffle, setIsShuffle] = useState(false)
  const [isRepeat, setIsRepeat] = useState(false)
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set())
  const [audioQuality, setAudioQuality] = useState<"LOW" | "MEDIUM" | "HIGH">("HIGH")
  const [equalizer, setEqualizer] = useState<"FLAT" | "BASS" | "TREBLE" | "VOCAL">("FLAT")
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(true)
  const [recentlyPlayed, setRecentlyPlayed] = useState<iTunesTrack[]>([])
  const [likedTracksList, setLikedTracksList] = useState<iTunesTrack[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [homeSelectionBusy, setHomeSelectionBusy] = useState(false)
  /** True while `search …` command awaits iTunes — drives MainContent search bar UI */
  const [searchPending, setSearchPending] = useState(false)
  const [sidebarArtistPick, setSidebarArtistPick] = useState<{
    query: string
    id: number
  } | null>(null)
  const [playbackPlaylist, setPlaybackPlaylist] = useState<{
    name: string
    coverSrc: string
  } | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  /** When true, right Now Playing column is collapsed. Starts true so the panel only opens after the user selects a track and expands (bottom bar or edge tab). */
  const [nowPlayingCollapsed, setNowPlayingCollapsed] = useState(true)

  const currentTrack =
    activeTrack !== null ? (tracks.find((t) => t.id === activeTrack) ?? null) : null
  const parseDuration = (time: string) => {
    const [m, s] = time.split(":").map(Number)
    return m * 60 + s
  }
  const totalTime = currentTrack ? parseDuration(currentTrack.time) : 0

  const activeNavRef = useRef(activeNav)
  const searchResultsRef = useRef(searchResults)
  const handleCommandRef = useRef<((input: string) => Promise<void>) | null>(null)
  /** Rotates 0–4 for `/api/dj` prompt variety (intro + transition). */
  const djFlowCycleRef = useRef(0)
  const nextDjFlowIndex = () => {
    const i = djFlowCycleRef.current % 5
    djFlowCycleRef.current += 1
    return i
  }
  const volumeRef = useRef(volume)
  const previewDuckActiveRef = useRef(false)
  volumeRef.current = volume
  activeNavRef.current = activeNav
  searchResultsRef.current = searchResults

  /** Lower iTunes preview volume while DJ TTS plays; restore after (and avoid volume slider fighting the duck). */
  const withPreviewDucked = useCallback(async (speakBlock: () => Promise<void>) => {
    const a = audioRef.current
    const normal = Math.min(1, Math.max(0, volumeRef.current / 100))
    let duckApplied = false
    if (a?.src && !a.paused && !a.ended) {
      previewDuckActiveRef.current = true
      a.volume = normal * 0.14
      duckApplied = true
    }
    try {
      await speakBlock()
    } finally {
      if (duckApplied && a) {
        a.volume = Math.min(1, Math.max(0, volumeRef.current / 100))
      }
      previewDuckActiveRef.current = false
    }
  }, [])

  const hasPlaybackTrack = currentAudioTrack !== null || activeTrack !== null
  const showNowPlayingPanel = hasPlaybackTrack && !nowPlayingCollapsed

  const addTerminalLog = (message: string) => {
    setCommandLogs((prev) => [
      ...prev,
      { input: "", responses: [{ type: "output", text: message }], timestamp: Date.now() },
    ])
  }

  useEffect(() => {
    if (!hasPlaybackTrack) setNowPlayingCollapsed(true)
  }, [hasPlaybackTrack])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIKED_TRACKS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as iTunesTrack[]
      if (!Array.isArray(parsed)) return
      const byId = new Map<string, iTunesTrack>()
      for (const t of parsed) {
        if (t && typeof t.id === "string" && !byId.has(t.id)) byId.set(t.id, t)
      }
      const unique = Array.from(byId.values())
      setLikedTracksList(unique)
      setLikedTracks(new Set(unique.map((t) => `itunes:${t.id}`)))
      if (unique.length !== parsed.length) {
        try {
          localStorage.setItem(LIKED_TRACKS_STORAGE_KEY, JSON.stringify(unique))
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    try {
      if (localStorage.getItem(VIBE_MODE_KEY) === "1") setVibeMode(true)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      document.documentElement.classList.remove("vibe-party-root")
      return
    }
    document.documentElement.classList.toggle("vibe-party-root", vibeMode)
    return () => {
      document.documentElement.classList.remove("vibe-party-root")
    }
  }, [isAuthenticated, vibeMode])

  useEffect(() => {
    try {
      localStorage.setItem(VIBE_MODE_KEY, vibeMode ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [vibeMode])

  useEffect(() => {
    if (activeNav === "6") setActiveNav("1")
    if (activeNav === "7") setActiveNav("2")
    if (activeNav === "8") setActiveNav("5")
  }, [activeNav])

  useEffect(() => {
    if (activeNav !== "4") {
      stopSpeech()
      setIsSpeaking(false)
    }
  }, [activeNav])
  useEffect(() => {
    if (currentAudioTrack || activeTrack === null) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((t) => {
          if (t >= totalTime - 1) {
            const next = activeTrack < tracks.length ? activeTrack + 1 : 1
            setActiveTrack(next)
            return 0
          }
          return t + 1
        })
      }, 1000)
    } else if (intervalRef.current) clearInterval(intervalRef.current)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, totalTime, activeTrack, currentAudioTrack])

  const triggerVoice = useCallback(
    (context: VoiceContext, trackName?: string) => {
      if (!aiVoiceEnabled) return
      if (activeNavRef.current !== "4") return
      const message = getVoiceResponse(context, trackName)
      setIsSpeaking(true)
      void (async () => {
        try {
          await withPreviewDucked(() => speak(message, DJ_SPEECH_CONFIG))
        } catch (e) {
          console.error("[AI DJ voice]", e)
        } finally {
          setIsSpeaking(false)
        }
      })()
    },
    [aiVoiceEnabled, withPreviewDucked],
  )

  const pushRecentlyPlayed = useCallback((track: iTunesTrack) => {
    setRecentlyPlayed((prev) => {
      const f = prev.filter((t) => t.id !== track.id)
      return [track, ...f].slice(0, 20)
    })
  }, [])

  const playTrack = (
    track: iTunesTrack,
    queue: iTunesTrack[] = [track],
    source?: { playlistName: string },
    opts?: { skipPlay?: boolean },
  ) => {
    if (source?.playlistName) {
      setPlaybackPlaylist({
        name: source.playlistName,
        coverSrc: getCuratedPlaylistCover(source.playlistName),
      })
    } else setPlaybackPlaylist(null)
    setCurrentAudioTrack(track)
    setSearchResults(queue)
    setCurrentTime(0)
    setTrackDuration(track.duration || 30)
    setActiveTrack(null)
    setIsPlaying(false)
    pushRecentlyPlayed(track)
    const a = audioRef.current
    if (!a) return
    a.pause()
    a.src = track.previewUrl
    a.currentTime = 0
    a.load()
    if (opts?.skipPlay) {
      addTerminalLog(`> loaded: ${track.title} - ${track.artist}`)
      addTerminalLog(`> press Space or click play (browser autoplay policy).`)
      return
    }
    a.play()
      .then(() => {
        setIsPlaying(true)
        addTerminalLog(`> now playing: ${track.title} - ${track.artist}`)
      })
      .catch(() => {
        setIsPlaying(false)
        addTerminalLog(`> loaded: ${track.title} — click play to start.`)
      })
  }

  const isTrackLiked = (id: string) => likedTracks.has(`itunes:${id}`)
  const persistLikedTracksList = (list: iTunesTrack[]) => {
    try {
      localStorage.setItem(LIKED_TRACKS_STORAGE_KEY, JSON.stringify(list))
    } catch {
      /* ignore */
    }
  }

  const toggleTrackLike = (track: iTunesTrack) => {
    const key = `itunes:${track.id}`
    setLikedTracks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        setLikedTracksList((list) => {
          const nl = list.filter((t) => t.id !== track.id)
          persistLikedTracksList(nl)
          return nl
        })
        addTerminalLog(`> removed "${track.title}" from liked tracks`)
      } else {
        next.add(key)
        setLikedTracksList((list) => {
          const nl = [track, ...list.filter((t) => t.id !== track.id)]
          persistLikedTracksList(nl)
          return nl
        })
        addTerminalLog(`> added "${track.title}" to liked tracks`)
      }
      return next
    })
  }

  const handleNext = () => {
    if (currentAudioTrack && searchResults.length > 0) {
      const idx = searchResults.findIndex((t) => t.id === currentAudioTrack.id)
      const nextIdx = idx >= 0 && idx < searchResults.length - 1 ? idx + 1 : 0
      const nextTrack = searchResults[nextIdx]
      setCurrentAudioTrack(nextTrack)
      pushRecentlyPlayed(nextTrack)
      setCurrentTime(0)
      if (audioRef.current) {
        audioRef.current.src = nextTrack.previewUrl
        audioRef.current.play().catch(() => {})
      }
      addTerminalLog(`> skipped to: ${nextTrack.title}`)
      return
    }
    const startId = activeTrack ?? 0
    const next = startId < tracks.length ? startId + 1 : 1
    const tr = tracks.find((t) => t.id === next) ?? tracks[0]
    setActiveTrack(next)
    setCurrentTime(0)
    setIsPlaying(true)
    addTerminalLog(`> skipped to: ${tr.title}`)
  }

  const handlePrev = () => {
    if (currentTime > 3) {
      setCurrentTime(0)
      if (audioRef.current?.src) audioRef.current.currentTime = 0
      addTerminalLog(`> restarting track...`)
      return
    }
    if (currentAudioTrack && searchResults.length > 0) {
      const idx = searchResults.findIndex((t) => t.id === currentAudioTrack.id)
      const prevIdx = idx > 0 ? idx - 1 : searchResults.length - 1
      const prevTrack = searchResults[prevIdx]
      setCurrentAudioTrack(prevTrack)
      pushRecentlyPlayed(prevTrack)
      setCurrentTime(0)
      if (audioRef.current) {
        audioRef.current.src = prevTrack.previewUrl
        audioRef.current.play().catch(() => {})
      }
      addTerminalLog(`> previous: ${prevTrack.title}`)
      return
    }
    if (activeTrack === null) {
      addTerminalLog(`> no track loaded.`)
      return
    }
    const prev = activeTrack > 1 ? activeTrack - 1 : tracks.length
    const tr = tracks.find((t) => t.id === prev) ?? tracks[0]
    setActiveTrack(prev)
    setCurrentTime(0)
    addTerminalLog(`> previous: ${tr.title}`)
  }

  const handlePlayPause = useCallback(() => {
    if (!currentAudioTrack && activeTrack === null) {
      addTerminalLog(`> no track loaded.`)
      return
    }
    if (currentAudioTrack) {
      const audio = audioRef.current
      if (!audio) return

      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
        addTerminalLog(`> playback halted`)
        return
      }

      if (!audio.src || !audio.src.includes(currentAudioTrack.previewUrl)) {
        audio.src = currentAudioTrack.previewUrl
        audio.currentTime = Math.min(currentTime, trackDuration)
        audio.load()
      }
      if (audio.ended || audio.currentTime >= Math.max(0, trackDuration - 0.25)) {
        audio.currentTime = 0
        setCurrentTime(0)
      }

      audio
        .play()
        .then(() => {
          setIsPlaying(true)
          addTerminalLog(`> playback resumed`)
        })
        .catch((error) => {
          setIsPlaying(false)
          addTerminalLog(`> playback blocked. click play again.`)
          console.error("[v0] audio play failed:", error)
        })
      return
    }
    setIsPlaying((p) => !p)
    addTerminalLog(!isPlaying ? `> playback resumed` : `> playback halted`)
  }, [currentAudioTrack, activeTrack, isPlaying, currentTime, trackDuration])

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds)
    if (audioRef.current?.src) audioRef.current.currentTime = seconds
    addTerminalLog(
      `> seek ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`,
    )
  }

  const handleShuffleToggle = () =>
    setIsShuffle((s) => {
      addTerminalLog(!s ? `> shuffle: ON` : `> shuffle: OFF`)
      return !s
    })
  const handleRepeatToggle = () =>
    setIsRepeat((r) => {
      addTerminalLog(!r ? `> repeat: ON` : `> repeat: OFF`)
      return !r
    })

  /** Same keys as `likedTracks` Set (`itunes:${track.id}` — includes `local-*` ids for mock playback) */
  const isCurrentLiked =
    currentAudioTrack !== null
      ? likedTracks.has(`itunes:${currentAudioTrack.id}`)
      : activeTrack !== null
        ? likedTracks.has(`itunes:${MOCK_LIKED_ID_PREFIX}${activeTrack}`)
        : false

  const handlePlaylistSelect = (name: string) => {
    if (name === "Liked Tracks" || name === "Recently Played") {
      setActiveNav("2")
      return
    }
    setSelectedPlaylist(name)
    setActiveNav("1")
  }

  const handleLikeToggle = () => {
    if (currentAudioTrack) {
      toggleTrackLike(currentAudioTrack)
      return
    }
    if (activeTrack !== null && currentTrack) {
      toggleTrackLike(mockTrackToLikedEntry(currentTrack))
      return
    }
    addTerminalLog(`> no track to like.`)
  }

  const announceDjTransitionRef = useRef(
    async (_a: iTunesTrack | null, _b: iTunesTrack, _n: number) => {},
  )

  const announceDjTransition = async (
    cur: iTunesTrack | null,
    next: iTunesTrack,
    queueSize: number,
  ) => {
    let msg = `${next.title} — ${next.artist}`
    try {
      const res = await fetch("/api/dj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentTrack: cur
            ? { title: cur.title, artist: cur.artist, album: cur.album }
            : null,
          nextTrack: { title: next.title, artist: next.artist, album: next.album },
          queueSize,
          flowIndex: nextDjFlowIndex(),
        }),
      })
      const data = await res.json()
      if (data.line) msg = data.line
    } catch {
      /* ignore */
    }
    if (!aiVoiceEnabled || activeNavRef.current !== "4") return
    setIsSpeaking(true)
    try {
      await withPreviewDucked(() => speak(msg, DJ_SPEECH_CONFIG))
    } catch (e) {
      console.error("[AI DJ voice]", e)
    } finally {
      setIsSpeaking(false)
    }
  }
  announceDjTransitionRef.current = announceDjTransition

  const announceDjIntro = async (first: iTunesTrack | null) => {
    let msg = "Party mode. Queue locked."
    try {
      const res = await fetch("/api/dj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "intro",
          nextTrack: first
            ? { title: first.title, artist: first.artist, album: first.album }
            : null,
          flowIndex: nextDjFlowIndex(),
        }),
      })
      const data = await res.json()
      if (data.line) msg = data.line
    } catch {
      /* ignore */
    }
    if (!aiVoiceEnabled || activeNavRef.current !== "4") return
    setIsSpeaking(true)
    try {
      await withPreviewDucked(() =>
        speak(msg, { ...DJ_SPEECH_CONFIG, style: 0.32, stability: 0.42 }),
      )
    } catch (e) {
      console.error("[AI DJ voice]", e)
    } finally {
      setIsSpeaking(false)
    }
  }

  const applyStateChange = (updates: StateUpdates) => {
    if (updates.activeTrack !== undefined) setActiveTrack(updates.activeTrack)
    if (updates.isPlaying !== undefined) {
      setIsPlaying(updates.isPlaying)
      if (audioRef.current?.src) {
        if (updates.isPlaying) audioRef.current.play().catch(() => {})
        else audioRef.current.pause()
      }
    }
    if (updates.volume !== undefined) {
      setVolume(updates.volume)
      if (audioRef.current) audioRef.current.volume = updates.volume / 100
    }
    if (updates.currentTime !== undefined) setCurrentTime(updates.currentTime)
    if (updates.autoDJ !== undefined) setAutoDJ(updates.autoDJ)
    if (updates.vibeMode !== undefined) setVibeMode(updates.vibeMode)
    if (updates.trackDuration !== undefined) setTrackDuration(updates.trackDuration)
  }

  const handleCommand = async (input: string) => {
    const trimmed = input.toLowerCase().trim()
    const normalizedCommand = trimmed.replace(/[\s_]+/g, "-")
    if (trimmed === "clear") {
      setCommandLogs([])
      return
    }
    if (trimmed === "voice status" || trimmed === "tts status") {
      addTerminalLog(`> ElevenLabs voice: ${getElevenLabsStatus()}`)
      return
    }
    setIsProcessing(true)

    if (
      (normalizedCommand === "sudo-auto-dj" ||
        normalizedCommand === "sudo-autodj" ||
        normalizedCommand === "sudo-dj") &&
      searchResults.length === 0
    ) {
      setCommandLogs((prev) => [
        ...prev,
        {
          input,
          responses: [
            { type: "typing", text: "> access granted..." },
            { type: "output", text: "> AI DJ..." },
            { type: "output", text: "> loading queue..." },
          ],
          timestamp: Date.now(),
        },
      ])
      const results = await searchITunes("top hits 2024", { limit: 12 })
      setSearchResults(results)
      setAutoDJ(true)
      if (results[0]) {
        await announceDjIntro(results[0])
        playTrack(results[0], results)
      } else addTerminalLog("> no tracks found.")
      setIsProcessing(false)
      return
    }

    // Match `search <query>` on normalized input so tabs / multiple spaces / leading
    // whitespace cannot skip this branch (otherwise parseCommand shows fake "loading" with no iTunes call).
    if (/^search\s+/i.test(trimmed)) {
      const query = trimmed.replace(/^search\s+/i, "").trim()
      if (!query) {
        setActiveNav("3")
        setCommandLogs((prev) => [
          ...prev,
          {
            input,
            responses: [{ type: "error", text: "> usage: search [artist or song name]" }],
            timestamp: Date.now(),
          },
        ])
        setIsProcessing(false)
        return
      }
      setActiveNav("3")
      setSearchPending(true)
      triggerVoice("search")
      try {
        const results = await searchITunes(query)
        setSearchResults(results)
        setCommandLogs((prev) => [
          ...prev,
          {
            input: `search ${query}`,
            responses: [
              { type: "typing", text: "> searching..." },
              {
                type: "output",
                text:
                  results.length === 0
                    ? "> no results."
                    : results.map((t, i) => `> [${i + 1}] ${t.title} - ${t.artist}`).join("\n"),
              },
            ],
            timestamp: Date.now(),
          },
        ])
      } finally {
        setSearchPending(false)
        setIsProcessing(false)
      }
      return
    }

    const playerState = { activeTrack, isPlaying, volume, tracks }
    const responses = parseCommand(input, playerState, searchResults)
    const newLog: CommandLog = { input, responses: [], timestamp: Date.now() }
    const voiceContext = shouldTriggerVoice(input)

    for (const response of responses) {
      if (response.text === "CLEAR_TERMINAL") {
        setCommandLogs([])
        continue
      }
      if (response.type === "typing") {
        newLog.responses.push(response)
        setCommandLogs((prev) => [
          ...prev.filter((l) => l.timestamp !== newLog.timestamp),
          { ...newLog },
        ])
        await new Promise((r) => setTimeout(r, 800))
      } else {
        if (response.stateChange) {
          if (response.stateChange.audioUrl && searchResults.length > 0) {
            const sel = searchResults[response.stateChange.selectedTrackIndex || 0]
            setPlaybackPlaylist(null)
            setCurrentAudioTrack(sel)
            pushRecentlyPlayed(sel)
            if (audioRef.current) {
              audioRef.current.src = response.stateChange.audioUrl
              audioRef.current.currentTime = 0
              audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
            }
            if (voiceContext === "play") triggerVoice("play", sel.title)
            applyStateChange(response.stateChange)
          } else if (voiceContext === "auto-dj" && response.stateChange.autoDJ) {
            const firstQueued = currentAudioTrack ?? searchResults[0] ?? null
            applyStateChange(response.stateChange)
            await announceDjIntro(firstQueued)
            if (firstQueued && !isPlaying) {
              playTrack(
                firstQueued,
                searchResults.length > 0 ? searchResults : [firstQueued],
              )
            }
          } else if (voiceContext && voiceContext !== "search") {
            triggerVoice(voiceContext)
            applyStateChange(response.stateChange)
          } else applyStateChange(response.stateChange)
        }
        newLog.responses.push(response)
        setCommandLogs((prev) => [
          ...prev.filter((l) => l.timestamp !== newLog.timestamp),
          { ...newLog },
        ])
        if (response.displayTime) await new Promise((r) => setTimeout(r, response.displayTime))
      }
    }
    setIsProcessing(false)
  }

  handleCommandRef.current = handleCommand

  const handleAutoDjToggle = () => {
    void handleCommand(autoDJ ? "sudo auto-dj off" : "sudo auto dj")
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isAuthenticated) {
        if (e.key === "Enter") {
          e.preventDefault()
          const a = audioRef.current
          if (a) {
            a.muted = true
            a.src = SILENT_AUDIO_UNLOCK
            void a.play().then(() => {
              a.pause()
              a.removeAttribute("src")
              a.muted = false
            })
          }
          setIsAuthenticated(true)
        }
        return
      }
      const el = e.target as HTMLElement
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        if (e.key === "Escape") (el as HTMLInputElement).blur()
        return
      }
      if (e.key >= "1" && e.key <= "9" && !e.ctrlKey && !e.metaKey) {
        const d = parseInt(e.key, 10)
        const r = searchResultsRef.current
        if (activeNavRef.current === "3" && r.length > 0 && d >= 1 && d <= r.length) {
          e.preventDefault()
          void handleCommandRef.current?.(`play ${d}`)
          return
        }
      }
      if (e.key >= "1" && e.key <= "5" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setActiveNav(e.key)
        return
      }
      if (e.key === " ") {
        e.preventDefault()
        handlePlayPause()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isAuthenticated, handlePlayPause])

  useEffect(() => {
    if (audioRef.current && !previewDuckActiveRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      if (currentAudioTrack) setCurrentTime(Math.floor(audio.currentTime))
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onMeta = () => {
      if (audio.duration > 0) setTrackDuration(Math.floor(audio.duration))
    }
    const onEnd = () => {
      if (isRepeat && currentAudioTrack) {
        audio.currentTime = 0
        void audio.play()
        return
      }
      if (searchResults.length > 0 && currentAudioTrack) {
        const ix = searchResults.findIndex((t) => t.id === currentAudioTrack.id)
        let ni = isShuffle
          ? Math.floor(Math.random() * searchResults.length)
          : ix + 1
        if (isShuffle && searchResults.length > 1) {
          while (ni === ix) ni = Math.floor(Math.random() * searchResults.length)
        }
        if (ni < searchResults.length) {
          const nt = searchResults[ni]
          const pt = currentAudioTrack
          const qLen = searchResults.length
          if (autoDJ) {
            void (async () => {
              try {
                await announceDjTransitionRef.current(pt, nt, qLen)
              } catch {
                /* announce handles its own errors */
              }
              const a = audioRef.current
              if (!a) return
              setCurrentAudioTrack(nt)
              pushRecentlyPlayed(nt)
              setCurrentTime(0)
              a.src = nt.previewUrl
              a.load()
              try {
                await a.play()
                setIsPlaying(true)
              } catch {
                setIsPlaying(false)
              }
            })()
          } else {
            setCurrentAudioTrack(nt)
            pushRecentlyPlayed(nt)
            setCurrentTime(0)
            audio.src = nt.previewUrl
            audio.load()
            void audio.play().then(() => setIsPlaying(true))
          }
        } else setIsPlaying(false)
      } else setIsPlaying(false)
    }
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("playing", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("loadedmetadata", onMeta)
    audio.addEventListener("ended", onEnd)
    return () => {
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("playing", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("loadedmetadata", onMeta)
      audio.removeEventListener("ended", onEnd)
    }
  }, [currentAudioTrack, searchResults, isRepeat, isShuffle, autoDJ, pushRecentlyPlayed])

  return (
    <>
      <audio ref={audioRef} preload="auto" playsInline controls={false} />
      {!isAuthenticated ? (
        <div className="splash-terminal-isolated min-h-screen w-screen">
          <SplashScreen />
        </div>
      ) : (
        <div
          className="app-frame flex h-screen w-screen flex-col overflow-x-hidden overflow-y-auto bg-background text-primary font-mono select-none transition-all duration-1000"
        >
          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
            <Sidebar
              activeNav={activeNav}
              selectionBusy={homeSelectionBusy}
              onNavChange={setActiveNav}
              onPlaylistSelect={handlePlaylistSelect}
              onFeaturedChartSelect={(name) => {
                setSelectedPlaylist(name)
                setActiveNav("1")
              }}
              onPopularArtistSelect={(artist) => {
                setSelectedPlaylist(null)
                setActiveNav("1")
                setSidebarArtistPick({ query: artist.query, id: Date.now() })
              }}
              vibeMode={vibeMode}
              onVibeModeChange={(next) => {
                setVibeMode(next)
                addTerminalLog(next ? `> theme: PARTY MODE` : `> theme: TERMINAL GREEN`)
              }}
              audioQuality={audioQuality}
              onAudioQualityChange={(q) => {
                setAudioQuality(q)
                addTerminalLog(`> audio: ${q}`)
              }}
              equalizer={equalizer}
              onEqualizerChange={(eq) => {
                setEqualizer(eq)
                addTerminalLog(`> eq: ${eq}`)
              }}
              aiVoiceEnabled={aiVoiceEnabled}
              onAiVoiceToggle={() => {
                setAiVoiceEnabled((v) => {
                  if (v) stopSpeech()
                  return !v
                })
              }}
            />
            <MainContent
              activeNav={activeNav}
              onHomeSelectionBusyChange={setHomeSelectionBusy}
              searchPending={searchPending}
              onSearchCommand={(q) => void handleCommand(`search ${q}`)}
              onTrackPlay={playTrack}
              onLikeToggle={toggleTrackLike}
              isLiked={isTrackLiked}
              currentTrackId={
                currentAudioTrack?.id ??
                (activeTrack !== null ? `${MOCK_LIKED_ID_PREFIX}${activeTrack}` : null)
              }
              recentlyPlayed={recentlyPlayed}
              likedTracksList={likedTracksList}
              selectedPlaylist={selectedPlaylist}
              onClearSelectedPlaylist={() => setSelectedPlaylist(null)}
              sidebarArtistPick={sidebarArtistPick}
              onSidebarArtistPickHandled={() => setSidebarArtistPick(null)}
              autoDJ={autoDJ}
              onAutoDjToggle={handleAutoDjToggle}
              isSpeaking={isSpeaking}
              currentTrack={currentAudioTrack?.title || currentTrack?.title || ""}
              currentArtist={currentAudioTrack?.artist || currentTrack?.artist || ""}
              commandLogs={commandLogs}
              onTerminalCommand={handleCommand}
              terminalProcessing={isProcessing}
              onTerminalFocusChange={setTerminalFocused}
              terminalRef={terminalRef}
            />
            {hasPlaybackTrack && (
              <div className="relative hidden min-h-0 shrink-0 lg:flex lg:flex-row lg:items-stretch">
                {!showNowPlayingPanel && hasPlaybackTrack && (
                  <button
                    type="button"
                    onClick={() => setNowPlayingCollapsed(false)}
                    className="absolute right-0 top-28 z-20 flex h-32 w-7 flex-col items-center justify-center gap-1 border border-primary/25 border-r-0 bg-background py-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground"
                    style={{ writingMode: "vertical-rl" }}
                  >
                    now playing
                  </button>
                )}
                <aside
                  className={`flex min-h-0 flex-col overflow-hidden border-primary/10 bg-background transition-all duration-300 ${
                    showNowPlayingPanel
                      ? "w-[min(420px,26vw)] min-w-[280px] max-w-[min(420px,32vw)] border-l opacity-100"
                      : "pointer-events-none w-0 border-l-0 opacity-0 min-w-0"
                  }`}
                >
                  <div className="relative flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-4 pt-8">
                    {showNowPlayingPanel && (
                      <button
                        type="button"
                        onClick={() => setNowPlayingCollapsed(true)}
                        className="absolute right-3 top-6 z-10 text-[10px] text-muted-foreground hover:text-primary"
                      >
                        [ collapse ]
                      </button>
                    )}
                    <NowPlaying
                      track={currentAudioTrack?.title || currentTrack?.title || ""}
                      artist={currentAudioTrack?.artist || currentTrack?.artist || ""}
                      album={currentAudioTrack?.album || currentTrack?.album || ""}
                      currentTime={currentTime}
                      totalTime={currentAudioTrack ? trackDuration : totalTime}
                      playlistCoverSrc={playbackPlaylist?.coverSrc ?? null}
                      playlistName={
                        playbackPlaylist?.name
                          ? getPlaylistDisplayLabel(
                              playbackPlaylist.name,
                              DEFAULT_CURATED_FETCH_LIMIT,
                            )
                          : null
                      }
                      trackArtworkUrl={currentAudioTrack?.artwork ?? null}
                      showSignalVisualizer={activeNav !== "4"}
                      isPlaying={isPlaying}
                      onPlayPause={handlePlayPause}
                      onNext={handleNext}
                      onPrev={handlePrev}
                      isLiked={isCurrentLiked}
                      onLikeToggle={handleLikeToggle}
                      canLike={currentAudioTrack !== null || activeTrack !== null}
                      onSeek={handleSeek}
                    />
                  </div>
                </aside>
              </div>
            )}
          </div>
          {hasPlaybackTrack ? (
            <BottomPlayer
              track={currentAudioTrack?.title || currentTrack?.title || ""}
              artist={currentAudioTrack?.artist || currentTrack?.artist || ""}
              album={currentAudioTrack?.album || currentTrack?.album || ""}
              currentTime={currentTime}
              totalTime={currentAudioTrack ? trackDuration : totalTime}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onNext={handleNext}
              onPrev={handlePrev}
              onSeek={handleSeek}
              volume={volume}
              onVolumeChange={setVolume}
              isShuffle={isShuffle}
              onShuffleToggle={handleShuffleToggle}
              isRepeat={isRepeat}
              onRepeatToggle={handleRepeatToggle}
              isLiked={isCurrentLiked}
              onLikeToggle={handleLikeToggle}
              playlistCoverSrc={playbackPlaylist?.coverSrc ?? null}
              playlistName={
                playbackPlaylist?.name
                  ? getPlaylistDisplayLabel(playbackPlaylist.name, DEFAULT_CURATED_FETCH_LIMIT)
                  : null
              }
              trackArtworkUrl={currentAudioTrack?.artwork ?? null}
              onOpenNowPlaying={() => setNowPlayingCollapsed(false)}
            />
          ) : null}
          <AppFooter />
        </div>
      )}
    </>
  )
}
