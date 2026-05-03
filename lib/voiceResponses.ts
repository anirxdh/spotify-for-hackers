// AI DJ voice-style responses
// Short, confident, futuristic system assistant tone

export type VoiceContext = 
  | 'play'
  | 'search'
  | 'skip'
  | 'prev'
  | 'pause'
  | 'resume'
  | 'auto-dj'
  | 'vibe-mode'
  | 'volume'
  | 'error'

const voiceBank: Record<VoiceContext, string[]> = {
  'play': [
    'Initiating playback sequence.',
    'Track locked. Deploying audio.',
    'Signal acquired. Playing now.',
    'Audio stream active.',
  ],
  'search': [
    'Scanning frequency bands...',
    'Searching the archive...',
    'Locating your vibe...',
    'Query transmitted.',
  ],
  'skip': [
    'Jumping to next signal.',
    'Track bypassed.',
    'Moving forward.',
    'Next frequency locked.',
  ],
  'prev': [
    'Reversing track order.',
    'Previous signal acquired.',
    'Going back.',
  ],
  'pause': [
    'Audio suspended.',
    'Playback halted.',
  ],
  'resume': [
    'Resuming transmission.',
    'Audio stream restored.',
    'Continuing playback.',
  ],
  'auto-dj': [
    'Access granted. AI DJ mode activated.',
    'Neural mixer online. Taking control.',
    'Autonomous mode engaged.',
  ],
  'vibe-mode': [
    'Entering enhanced sensory mode.',
    'Vibe protocols activated.',
    'Visual enhancement deployed.',
  ],
  'volume': [
    'Amplitude adjusted.',
    'Output level modified.',
    'Volume recalibrated.',
  ],
  'error': [
    'Command not recognized.',
    'Invalid input detected.',
    'Syntax error.',
  ],
}

export function getVoiceResponse(context: VoiceContext, trackName?: string): string {
  const responses = voiceBank[context]
  const base = responses[Math.floor(Math.random() * responses.length)]
  
  if (context === 'play' && trackName) {
    return `Now playing: ${trackName}`
  }
  
  if (context === 'skip' && trackName) {
    return `Skipping to: ${trackName}`
  }
  
  return base
}

export function shouldTriggerVoice(command: string): VoiceContext | null {
  const cmd = command.toLowerCase().trim()
  const normalized = cmd.replace(/[\s_]+/g, '-')
  
  if (cmd.startsWith('play')) return 'play'
  if (cmd.startsWith('search')) return 'search'
  if (cmd === 'skip') return 'skip'
  if (cmd === 'prev') return 'prev'
  if (cmd === 'pause') return 'pause'
  if (cmd === 'resume') return 'resume'
  if (normalized === 'sudo-auto-dj' || normalized === 'sudo-autodj' || normalized === 'sudo-dj') return 'auto-dj'
  if (normalized === 'sudo-vibe-mode') return 'vibe-mode'
  if (cmd.startsWith('volume')) return 'volume'
  
  return null
}
