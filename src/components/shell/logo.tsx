// Recreated as SVG (not a raster export) so it stays crisp at any size and
// can take its color from `className` (navy on the login page, white in the
// dark nav bar) via `currentColor` rather than needing separate asset files.
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="250" cy="250" r="228" stroke="currentColor" strokeWidth="14" />

      <text
        x="250"
        y="195"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Merriweather, Georgia, serif"
        fontWeight="700"
        fontSize="42"
        letterSpacing="6"
      >
        THE
      </text>
      <text
        x="250"
        y="270"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Merriweather, Georgia, serif"
        fontWeight="700"
        fontSize="60"
        letterSpacing="2"
      >
        BUTTERLEIGH
      </text>
      <text
        x="250"
        y="345"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Merriweather, Georgia, serif"
        fontWeight="700"
        fontSize="78"
        letterSpacing="4"
      >
        INN
      </text>

      <g fill="currentColor">
        <ellipse cx="150" cy="345" rx="26" ry="13" transform="rotate(-40 150 345)" />
        <ellipse cx="163" cy="373" rx="26" ry="13" transform="rotate(-25 163 373)" />
        <ellipse cx="180" cy="399" rx="26" ry="13" transform="rotate(-8 180 399)" />
        <ellipse cx="200" cy="420" rx="26" ry="13" transform="rotate(10 200 420)" />
        <path
          d="M138 335 Q170 380 210 428"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
