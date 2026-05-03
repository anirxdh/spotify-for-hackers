export interface CommandResponse {
  type: 'output' | 'error' | 'typing'
  text: string
  displayTime?: number
  stateChange?: StateUpdates
}

export interface CommandLog {
  input: string
  responses: CommandResponse[]
  timestamp: number
}

export interface PlayerState {
  activeTrack: number | null
  isPlaying: boolean
  volume: number
  tracks: any[]
}

export interface StateUpdates {
  activeTrack?: number
  isPlaying?: boolean
  volume?: number
  currentTime?: number
  autoDJ?: boolean
  vibeMode?: boolean
  searchResults?: any[]
  selectedTrackIndex?: number
  audioUrl?: string
  trackDuration?: number
}

export function parseCommand(
  input: string,
  playerState: PlayerState,
  searchResults?: any[],
  selectedTrackIndex?: number
): CommandResponse[] {
  const parts = input.trim().toLowerCase().split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1)

  if (!command) return []

  switch (command) {
    case 'search': {
      if (args.length === 0) {
        return [{ type: 'error', text: '> usage: search [artist or song name]' }]
      }
      const query = args.join(' ')
      return [
        { type: 'typing', text: `> searching for "${query}"...` },
        { type: 'output', text: `> loading...` }
      ]
    }

    case 'play': {
      // Playing from search results
      if (searchResults && searchResults.length > 0) {
        const trackNum = parseInt(args[0])
        if (isNaN(trackNum) || trackNum < 1 || trackNum > searchResults.length) {
          return [{ type: 'error', text: `> invalid selection. use: play [1-${searchResults.length}]` }]
        }

        const selectedTrack = searchResults[trackNum - 1]
        return [
          { type: 'typing', text: '> locating track...' },
          { type: 'output', text: '> streaming preview audio...' },
          { 
            type: 'output', 
            text: `> now playing: ${selectedTrack.title} - ${selectedTrack.artist}`,
            stateChange: { 
              audioUrl: selectedTrack.previewUrl,
              trackDuration: selectedTrack.duration,
              isPlaying: true, 
              currentTime: 0,
              selectedTrackIndex: trackNum - 1
            }
          }
        ]
      }

      // Playing from mock tracks (original behavior)
      if (args.length === 0) {
        const activeTrack = playerState.activeTrack ?? 1
        return [
          { type: 'output', text: `> now playing: ${playerState.tracks[activeTrack - 1]?.title || 'track'}`, stateChange: { activeTrack, isPlaying: true } }
        ]
      }

      const trackQuery = args.join(' ').toLowerCase()
      const trackNum = parseInt(args[0])

      let targetTrack = playerState.activeTrack ?? 1

      if (!isNaN(trackNum) && trackNum > 0 && trackNum <= playerState.tracks.length) {
        targetTrack = trackNum
      } else {
        const found = playerState.tracks.findIndex(t =>
          t.title.toLowerCase().includes(trackQuery) ||
          t.artist.toLowerCase().includes(trackQuery)
        )
        if (found !== -1) {
          targetTrack = found + 1
        }
      }

      const track = playerState.tracks[targetTrack - 1]
      return [
        { type: 'typing', text: '> switching track...' },
        { 
          type: 'output', 
          text: `> now playing: ${track.title} - ${track.artist}`,
          stateChange: { activeTrack: targetTrack, isPlaying: true, currentTime: 0 }
        }
      ]
    }

    case 'pause': {
      return [{ type: 'output', text: '> playback halted', stateChange: { isPlaying: false } }]
    }

    case 'resume': {
      return [{ type: 'output', text: '> playback resumed', stateChange: { isPlaying: true } }]
    }

    case 'skip': {
      const activeTrack = playerState.activeTrack ?? 1
      const next = activeTrack < playerState.tracks.length ? activeTrack + 1 : 1
      const track = playerState.tracks[next - 1]
      return [
        { type: 'typing', text: '> skipping...' },
        { 
          type: 'output', 
          text: `> now playing: ${track.title} - ${track.artist}`,
          stateChange: { activeTrack: next, isPlaying: true, currentTime: 0 }
        }
      ]
    }

    case 'prev': {
      const activeTrack = playerState.activeTrack ?? 1
      const prev = activeTrack > 1 ? activeTrack - 1 : playerState.tracks.length
      const track = playerState.tracks[prev - 1]
      return [
        { type: 'typing', text: '> previous track...' },
        { 
          type: 'output', 
          text: `> now playing: ${track.title} - ${track.artist}`,
          stateChange: { activeTrack: prev, isPlaying: true, currentTime: 0 }
        }
      ]
    }

    case 'now-playing': {
      const activeTrack = playerState.activeTrack ?? 1
      const track = playerState.tracks[activeTrack - 1]
      const status = playerState.isPlaying ? 'playing' : 'paused'
      return [
        { type: 'output', text: `> ${track.title} - ${track.artist}` },
        { type: 'output', text: `> album: ${track.album}` },
        { type: 'output', text: `> status: ${status}` }
      ]
    }

    case 'volume': {
      if (args.length === 0) {
        return [{ type: 'output', text: `> volume: ${playerState.volume}%` }]
      }

      const vol = parseInt(args[0])
      if (isNaN(vol) || vol < 0 || vol > 100) {
        return [{ type: 'error', text: '> error: volume must be between 0 and 100.' }]
      }

      return [{ type: 'output', text: `> volume set to ${vol}%`, stateChange: { volume: vol } }]
    }

    case 'clear': {
      return [{ type: 'output', text: 'CLEAR_TERMINAL' }]
    }

    case 'help': {
      const helpText = `> Available commands:
> search [artist/song] - Search iTunes for music
> play [number] - Play a track (use after search)
> pause - Pause playback
> resume - Resume playback
> skip - Skip to next track
> prev - Play previous track
> now-playing - Show current track info
> volume [0-100] - Set volume
> clear - Clear terminal
> help - Show this help message
> sudo auto-dj / sudo auto dj - Enable AI DJ mode
> sudo auto-dj off - Disable AI DJ mode
> sudo vibe-mode / sudo vibe mode - Transform to vibe mode`
      return [{ type: 'output', text: helpText }]
    }

    case 'sudo': {
      const subcommand = args.join(' ').replace(/[\s_]+/g, '-')
      
      if (subcommand === 'auto-dj' || subcommand === 'autodj' || subcommand === 'dj') {
        return [
          { type: 'typing', text: '> access granted...' },
          { type: 'output', text: '> AI DJ mode activated...', stateChange: { autoDJ: true } },
          { type: 'output', text: '> mixing from the active iTunes queue...' }
        ]
      }

      if (subcommand === 'auto-dj-off' || subcommand === 'autodj-off' || subcommand === 'dj-off' || subcommand === 'stop-auto-dj') {
        return [
          { type: 'typing', text: '> shutting down DJ loop...' },
          { type: 'output', text: '> AI DJ mode disabled.', stateChange: { autoDJ: false } }
        ]
      }
      
      if (subcommand === 'vibe-mode') {
        return [
          { type: 'typing', text: '> entering vibe mode...' },
          { type: 'output', text: '> enhancing sensory experience...', stateChange: { vibeMode: true } }
        ]
      }
      
      return [{ type: 'error', text: '> sudo: command not found.' }]
    }

    default: {
      return [{ type: 'error', text: `> command not found: ${command}. type 'help' for available commands.` }]
    }
  }
}
