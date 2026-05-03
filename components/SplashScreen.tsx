"use client"

import { useEffect, useState } from "react"

const MS_PER_CHAR = 28
const MS_PER_CHAR_VERSION = 22
const VERSION_LINE = "spotify.trm v2.0.1"
/** Pause after logo entrance animation before typing version */
const AFTER_LOGO_MS = 650
/** Pause after version line finishes before main splash content */
const AFTER_VERSION_MS = 380

/** Shown in the bordered panel under the splash banner (matches app branding) */
const APP_VERSION_LABEL = "v2.0.1"
const BUILD_SPLASH_VALUE = "hackathon edition"

const SCRIPT_LINES = [
  "> Spotify, reimagined as a terminal",
  "----------------------------------------",
  "> initializing audio matrix...",
  "> loading playlists...",
  "> press enter to continue...",
]

type Stage = "logo" | "version" | "body"

function SplashVersionPanel() {
  return (
    <div
      className="mb-8 w-full max-w-[min(100%,520px)] rounded-lg border border-[#1DB954] bg-black px-5 py-4 shadow-[0_0_24px_rgba(29,185,84,0.12)] sm:px-6 sm:py-5"
      role="status"
      aria-label={`Spotify terminal ${APP_VERSION_LABEL}, build ${BUILD_SPLASH_VALUE}`}
    >
      <div className="space-y-2 text-sm leading-snug sm:text-base">
        <p className="text-[#00ff41]">
          <span aria-hidden="true" className="select-none">
            &gt;_
          </span>{" "}
          <span className="font-bold tracking-tight">Spotify</span>
          <span className="ml-1.5 font-normal text-[#9ca3af]">({APP_VERSION_LABEL})</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
          <span className="shrink-0 text-[#00ff41]">build:</span>
          <span className="text-[#e8e8e8]">{BUILD_SPLASH_VALUE}</span>
        </p>
      </div>
    </div>
  )
}

export default function SplashScreen() {
  const [stage, setStage] = useState<Stage>("logo")
  const [logoIn, setLogoIn] = useState(false)
  const [versionText, setVersionText] = useState("")
  const [versionDone, setVersionDone] = useState(false)

  const [completed, setCompleted] = useState<string[]>([])
  const [partial, setPartial] = useState("")
  const [finished, setFinished] = useState(false)

  /* Logo: scale + fade in */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setLogoIn(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  /* After logo settles → version typing */
  useEffect(() => {
    if (!logoIn) return
    const t = setTimeout(() => setStage("version"), AFTER_LOGO_MS)
    return () => clearTimeout(t)
  }, [logoIn])

  /* Type spotify.trm v2.0.1 */
  useEffect(() => {
    if (stage !== "version") return
    setVersionText("")
    setVersionDone(false)
    let i = 0
    const id = setInterval(() => {
      i += 1
      if (i <= VERSION_LINE.length) {
        setVersionText(VERSION_LINE.slice(0, i))
      } else {
        clearInterval(id)
        setVersionDone(true)
        setTimeout(() => setStage("body"), AFTER_VERSION_MS)
      }
    }, MS_PER_CHAR_VERSION)
    return () => clearInterval(id)
  }, [stage])

  /* Original splash script — runs after intro */
  useEffect(() => {
    if (stage !== "body") return

    let lineIdx = 0
    let charIdx = 0
    let id: ReturnType<typeof setInterval> | undefined

    const step = () => {
      if (lineIdx >= SCRIPT_LINES.length) {
        setFinished(true)
        setPartial("")
        if (id !== undefined) clearInterval(id)
        return
      }

      const target = SCRIPT_LINES[lineIdx]

      if (charIdx < target.length) {
        charIdx++
        setPartial(target.slice(0, charIdx))
        return
      }

      setCompleted((prev) => [...prev, target])
      lineIdx++
      charIdx = 0

      if (lineIdx >= SCRIPT_LINES.length) {
        setFinished(true)
        setPartial("")
        if (id !== undefined) clearInterval(id)
        return
      }

      charIdx = 1
      setPartial(SCRIPT_LINES[lineIdx].slice(0, 1))
    }

    step()
    id = setInterval(step, MS_PER_CHAR)
    return () => {
      if (id !== undefined) clearInterval(id)
    }
  }, [stage])

  return (
    <div className="min-h-screen w-screen overflow-auto bg-black text-[#00ff41] font-mono antialiased flex flex-col items-start justify-start px-4 pt-6 pb-6 sm:px-8 sm:pt-10">
      {/* Intro: logo + version line centered together in the viewport */}
      {(stage === "logo" || stage === "version") && (
        <div className="flex w-full min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-2 sm:min-h-[calc(100vh-4rem)]">
          <div className="flex w-full max-w-[min(96vw,640px)] flex-col items-center">
            {/* Fixed-height slot so logo scale-down does not reflow the column */}
            <div className="flex h-[min(300px,58vw)] w-full max-w-[min(400px,92vw)] shrink-0 items-center justify-center sm:h-80 sm:max-w-[440px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.png"
                alt=""
                width={256}
                height={256}
                className={`max-h-full max-w-full object-contain transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
                  stage === "version"
                    ? "scale-[0.72] opacity-100 drop-shadow-[0_0_32px_rgba(0,255,65,0.5)]"
                    : logoIn
                      ? "scale-100 opacity-100 drop-shadow-[0_0_44px_rgba(0,255,65,0.55)]"
                      : "scale-[0.42] opacity-0"
                }`}
                style={{ imageRendering: "auto" }}
              />
            </div>

            {/* Reserved line height so typing does not push the logo when it appears */}
            <div className="mt-4 flex min-h-[2.75rem] w-full max-w-[min(96vw,640px)] flex-col items-center justify-center text-center font-mono text-xl leading-tight tracking-[0.06em] text-[#00ff41] sm:mt-5 sm:min-h-[3.25rem] sm:text-2xl">
              {stage === "version" ? (
                <span className="inline-flex flex-wrap items-baseline justify-center gap-0">
                  <span>{versionText}</span>
                  {!versionDone ? <span className="cursor-blink leading-none">|</span> : null}
                </span>
              ) : (
                <span className="invisible select-none" aria-hidden>
                  {VERSION_LINE}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rest of splash — banner + terminal script */}
      {stage === "body" && (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both w-full max-w-[980px] flex flex-col items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/splash-banner.png"
            alt=""
            className="block w-full max-w-[min(100%,520px)] h-auto mb-8 shrink-0 self-start"
            style={{ imageRendering: "pixelated" }}
          />

          <SplashVersionPanel />

          <div className="w-full max-w-[760px] pl-3 text-sm leading-relaxed space-y-1 sm:pl-5 sm:text-base">
            {finished ? (
              <>
                {completed.slice(0, -1).map((line, i) => (
                  <div
                    key={`done-${i}`}
                    className={[
                      line.startsWith("-") ? "text-[#00882a]" : "",
                      i === 0 ? "text-sm sm:text-base" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {line}
                  </div>
                ))}
                {completed.length > 0 && (
                  <div
                    className={`inline-flex items-baseline gap-0 flex-wrap mt-1 ${
                      completed.length === 1 ? "text-sm sm:text-base" : ""
                    }`}
                  >
                    <span>{completed[completed.length - 1]}</span>
                    <span className="cursor-blink leading-none">|</span>
                  </div>
                )}
              </>
            ) : (
              <>
                {completed.map((line, i) => (
                  <div
                    key={`mid-${i}`}
                    className={[
                      line.startsWith("-") ? "text-[#00882a]" : "",
                      i === 0 ? "text-sm sm:text-base" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {line}
                  </div>
                ))}
                {partial !== "" && (
                  <div
                    className={[
                      "inline-flex items-baseline gap-0 flex-wrap mt-0",
                      completed.length === 0 ? "text-sm sm:text-base" : "",
                      partial.startsWith("-") ? "text-[#00882a]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span>{partial}</span>
                    <span className="cursor-blink leading-none">|</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
