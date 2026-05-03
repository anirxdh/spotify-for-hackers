"use client"

import { forwardRef, useState } from "react"
import Terminal, { TerminalHandle } from "./Terminal"
import { CommandLog } from "@/lib/commandParser"

interface Props {
  logs: CommandLog[]
  onCommand: (input: string) => void
  isInputDisabled: boolean
  onFocusChange?: (focused: boolean) => void
  /** sidebar = fixed-width dock (legacy); panel = fills parent column under Now Playing */
  variant?: "sidebar" | "panel"
}

const DockedTerminal = forwardRef<TerminalHandle, Props>(function DockedTerminal(
  { logs, onCommand, isInputDisabled, onFocusChange, variant = "sidebar" },
  ref
) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isPanel = variant === "panel"

  const titleBar = (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card flex-shrink-0 border-b border-primary/10">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-primary text-xs font-mono text-glow-sm shrink-0">{">_"}</span>
        {isPanel ? (
          <>
            <span className="text-muted-foreground text-xs tracking-widest shrink-0">TERMINAL MUSIC</span>
            <span className="text-muted-foreground/85 text-[10px] font-mono sm:border-l sm:border-primary/20 sm:pl-2">
              type help for commands
            </span>
          </>
        ) : (
          <span className="text-primary text-xs font-mono tracking-wider truncate">terminal@spotify</span>
        )}
      </div>
      {!isPanel && (
        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse terminal"
          aria-label="Collapse terminal"
          className="text-muted-foreground hover:text-primary hover:bg-secondary w-6 h-6 flex items-center justify-center font-mono text-xs transition-colors"
        >
          {">"}
        </button>
      )}
    </div>
  )

  const terminalBody = (
    <div className={`${isPanel ? "min-h-[160px]" : ""} flex-1 min-h-0 p-2 overflow-hidden`}>
      <Terminal
        ref={ref}
        logs={logs}
        onCommand={onCommand}
        isInputDisabled={isInputDisabled}
        onFocusChange={onFocusChange}
      />
    </div>
  )

  if (!isPanel && isCollapsed) {
    return (
      <aside className="w-10 bg-background flex-shrink-0 flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expand terminal"
          aria-label="Expand terminal"
          className="text-primary text-glow-sm hover:bg-secondary w-8 h-8 flex items-center justify-center font-mono"
        >
          {"<"}
        </button>
        <div
          className="text-muted-foreground text-[10px] font-mono tracking-widest"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          TERMINAL
        </div>
      </aside>
    )
  }

  if (isPanel) {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full bg-background">
        {titleBar}
        {terminalBody}
      </div>
    )
  }

  return (
    <aside className="w-[360px] min-w-[280px] max-w-[480px] bg-background flex-shrink-0 hidden md:flex flex-col">
      {titleBar}
      {terminalBody}
    </aside>
  )
})

export default DockedTerminal
