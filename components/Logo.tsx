interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ size = 28, showWordmark = true, className = "" }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="OpsCanvas"
      >
        <defs>
          <linearGradient id="oc-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C5CFF" />
            <stop offset="100%" stopColor="#00D9FF" />
          </linearGradient>
          <radialGradient id="oc-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#oc-grad)" fillOpacity="0.10" />
        <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#oc-grad)" strokeOpacity="0.45" strokeWidth="1" />

        <circle cx="16" cy="16" r="9" fill="url(#oc-glow)" />

        <line x1="8.5" y1="9" x2="16" y2="16" stroke="url(#oc-grad)" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="23.5" y1="9" x2="16" y2="16" stroke="url(#oc-grad)" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="16" y1="24" x2="16" y2="16" stroke="url(#oc-grad)" strokeWidth="1.4" strokeLinecap="round" />

        <circle cx="8.5" cy="9" r="2" fill="url(#oc-grad)" />
        <circle cx="23.5" cy="9" r="2" fill="url(#oc-grad)" />
        <circle cx="16" cy="24" r="2" fill="url(#oc-grad)" />

        <circle cx="16" cy="16" r="3" fill="#0A0A0F" stroke="url(#oc-grad)" strokeWidth="1.6" />
        <circle cx="16" cy="16" r="1.2" fill="url(#oc-grad)" />
      </svg>

      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          Ops<span className="gradient-brand">Canvas</span>
        </span>
      )}
    </div>
  );
}
