const wordmarkPaths = [
  'M31 5V52M31 35a13 13 0 1 0-26 0a13 13 0 1 0 26 0',
  'M47 35H74C74 17 46 17 46 35S64 53 74 44',
  'M88 52V31C88 19 109 19 109 31V52M109 31C109 19 130 19 130 31V52',
  'M144 35H171C171 17 143 17 143 35S161 53 171 44',
  'M184 52V32C184 19 212 19 212 32V52',
  'M228 8V37Q228 48 240 48M221 22H242',
  'M254 18V52',
  'M294 35a13 13 0 1 0-26 0a13 13 0 1 0 26 0M294 18V52',
]
export function DementiaMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M22.5 3V30M22.5 19a8.5 8.5 0 1 0-17 0a8.5 8.5 0 1 0 17 0"
        stroke="currentColor"
        strokeWidth="5.8"
        strokeLinecap="butt"
      />
    </svg>
  )
}
export function DementiaWordmark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={'dementia-wordmark ' + className}
      viewBox="0 0 304 64"
      fill="none"
      role="img"
      aria-label="dementia"
    >
      <g stroke="currentColor" strokeWidth="9" strokeLinecap="butt" strokeLinejoin="round">
        {wordmarkPaths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <rect x="249.5" y="3.5" width="9" height="9" rx="0.8" fill="currentColor" />
    </svg>
  )
}
export function DementiaLogo() {
  return (
    <span className="brand-lockup">
      <DementiaWordmark />
      <span className="brand-sub">CONTROL PANEL</span>
    </span>
  )
}
