// Elementos gráficos da marca reutilizados em Login, Home e Check-in.

// Faixa com 3 blocos (gunmetal 8 / laranja 5 / rosa 3).
export function FaixaTricolor({ altura = 'h-3' }: { altura?: string }) {
  return (
    <div className={`flex ${altura}`} aria-hidden="true">
      <span className="flex-[8] bg-gunmetal-gray" />
      <span className="flex-[5] bg-mandarin-orange" />
      <span className="flex-[3] bg-soft-pink" />
    </div>
  )
}

// Meridianos de globo (decoração de fundo do login).
export function MeridianosDecor({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      fill="none"
      stroke="#FFE4DC"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="200" cy="200" r="190" />
      <ellipse cx="200" cy="200" rx="140" ry="190" />
      <ellipse cx="200" cy="200" rx="85" ry="190" />
      <ellipse cx="200" cy="200" rx="35" ry="190" />
      <ellipse cx="200" cy="120" rx="170" ry="38" />
      <ellipse cx="200" cy="280" rx="170" ry="38" />
      <line x1="10" y1="200" x2="390" y2="200" />
    </svg>
  )
}

// Arcos concêntricos brancos (18%) sobre gunmetal: fallback do hero sem mídia.
export function ArcosConcentricos({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity="0.18"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      {[40, 80, 120, 160, 200, 240, 280].map((r) => (
        <circle key={r} cx="400" cy="400" r={r} />
      ))}
    </svg>
  )
}
