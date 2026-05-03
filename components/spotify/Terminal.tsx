"use client"

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { CommandLog } from "@/lib/commandParser"

export interface TerminalHandle {
  focus: () => void
  blur: () => void
  isFocused: () => boolean
}

const Terminal = forwardRef<TerminalHandle, {
  logs: CommandLog[]
  onCommand: (input: string) => void
  isInputDisabled: boolean
  onFocusChange?: (focused: boolean) => void
}>(function Terminal({
  logs,
  onCommand,
  isInputDisabled,
  onFocusChange,
}, ref) {
  const [input, setInput] = useState("")
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const focusInputAtEnd = () => {
    const el = inputRef.current
    if (!el || el.disabled) return
    el.focus()
    const len = el.value.length
    queueMicrotask(() => el.setSelectionRange(len, len))
  }

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    isFocused: () => isFocused,
  }))

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (input.trim()) {
        onCommand(input)
        setInput("")
        setHistoryIndex(null)
      }
      e.preventDefault()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const nextIndex = historyIndex === null ? logs.length - 1 : historyIndex - 1
      if (nextIndex >= 0 && nextIndex < logs.length) {
        setHistoryIndex(nextIndex)
        setInput(logs[nextIndex].input)
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex === null) return
      const nextIndex = historyIndex + 1
      if (nextIndex < logs.length) {
        setHistoryIndex(nextIndex)
        setInput(logs[nextIndex].input)
      } else {
        setHistoryIndex(null)
        setInput("")
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 bg-card text-xs font-mono h-full min-h-0">
      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto text-primary space-y-1 pr-1"
        style={{ wordBreak: "break-word" }}
      >
        {logs.map((log, logIdx) => (
          <div key={logIdx} className="space-y-1">
            {/* Input line - only show if there was user input */}
            {log.input && (
              <div className="flex items-center gap-1 text-primary">
                <span className="text-muted-foreground">user@spotify:~$</span>
                <span className="text-primary">{log.input}</span>
              </div>
            )}

            {/* Responses */}
            {log.responses.map((response, respIdx) => (
              <div key={respIdx} className={log.input ? "pl-4" : ""}>
                {response.type === "error" && (
                  <div className="text-red-500 text-glow-sm">{response.text}</div>
                )}
                {response.type === "output" && (
                  <div className="text-primary whitespace-pre-wrap">{response.text}</div>
                )}
                {response.type === "typing" && (
                  <div className="text-primary animate-typing">{response.text}</div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* field-sizing: narrow input; flex-1 hit strip; block | only when unfocused (native caret when typing) */}
      <div
        className={`flex w-full min-w-0 items-center gap-1 pt-2 ${isFocused ? "bg-accent/20" : ""}`}
      >
        <span className="text-muted-foreground shrink-0">user@spotify:~$</span>
        <div
          className="flex min-h-[1.25em] min-w-0 flex-1 cursor-text items-center overflow-x-auto"
          onMouseDown={(e) => {
            if (e.target === inputRef.current) return
            e.preventDefault()
            focusInputAtEnd()
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true)
              onFocusChange?.(true)
            }}
            onBlur={() => {
              setIsFocused(false)
              onFocusChange?.(false)
            }}
            disabled={isInputDisabled}
            placeholder=""
            aria-label="Terminal command line"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="m-0 box-border min-h-[1.25em] min-w-0 max-w-full border-0 bg-transparent p-0 px-0 py-0 font-mono text-sm leading-none text-primary caret-primary outline-none [field-sizing:content] placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {!isFocused && (
            <span className="shrink-0 animate-pulse text-primary leading-none opacity-70" aria-hidden>
              |
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

export default Terminal
