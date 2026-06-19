import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0A0A0F",
          elevated: "#0F0F17",
        },
        surface: {
          DEFAULT: "#13131C",
          elevated: "#1A1A26",
          hover: "#202030",
        },
        border: {
          DEFAULT: "#22222E",
          strong: "#2D2D3D",
          accent: "#3A3A52",
        },
        ink: {
          DEFAULT: "#F5F5F7",
          muted: "#9A9AA8",
          dim: "#5A5A68",
        },
        brand: {
          DEFAULT: "#7C5CFF",
          glow: "#9D85FF",
          deep: "#5B3FE0",
        },
        accent: {
          cyan: "#00D9FF",
          violet: "#7C5CFF",
        },
        state: {
          stable: "#22D682",
          watch: "#FFB547",
          risk: "#FF5C5C",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
        display: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(124, 92, 255, 0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.02), 0 12px 32px -16px rgba(0,0,0,0.6)",
        cardHover: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(124,92,255,0.25), 0 20px 48px -20px rgba(124,92,255,0.25)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #7C5CFF 0%, #00D9FF 100%)",
        "subtle-gradient": "linear-gradient(180deg, rgba(124,92,255,0.06) 0%, rgba(124,92,255,0) 100%)",
        "grid-pattern": "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(0.85)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "fade-in-up": "fade-in-up 0.4s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
