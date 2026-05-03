"use client"

/** Bar heights for idle animation (matches legacy featured visualizer) */
const BAR_HEIGHTS = [
  44, 78, 56, 92, 64, 35, 84, 52, 96, 68, 42, 74, 58, 88, 48, 70,
]

/** SIGNAL strip — used below artwork on the right pane */
export default function SidebarVisualizer({ isActive }: { isActive: boolean }) {
  return (
    <div className="w-full shrink-0">
      <div className="text-muted-foreground text-[10px] mb-2 tracking-widest">
        {">"} SIGNAL
      </div>
      <div
        className={`mb-1.5 text-[10px] font-mono tracking-[0.2em] ${
          isActive ? "text-primary text-glow-sm" : "text-muted-foreground"
        }`}
      >
        {isActive ? "LIVE" : "NO SIGNAL"}
      </div>
      <div
        className={`featured-visualizer featured-visualizer--stretch h-[88px] w-full ${isActive ? "is-active" : ""}`}
        aria-label={isActive ? "Audio signal active" : "No signal"}
      >
        <div className="visualizer-grid h-full max-h-[88px]">
          {BAR_HEIGHTS.map((height, i) => (
            <span
              key={i}
              className="visualizer-bar"
              style={{
                height: `${height}%`,
                animationDelay: `${-(i % 7) * 0.16}s`,
                animationDuration: `${0.72 + (i % 5) * 0.11}s`,
              }}
            />
          ))}
        </div>
        <div className="visualizer-readout">
          <span>{">"}</span>
          <span>{isActive ? "RX" : "—"}</span>
        </div>
      </div>
    </div>
  )
}
