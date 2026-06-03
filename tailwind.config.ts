import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05070d",
        surface: "#0b0f1a",
        "surface-2": "#111827",
        border: "#1a2540",
        accent: "#00d4ff",       // electric cyan  – Edges
        "accent-2": "#00ff94",   // electric green – Corners
        purple: "#a855f7",
        yellow: "#ffd60a",
        danger: "#ff2d78",
        muted: "#4a6080",
      },
      boxShadow: {
        "neon-blue":    "0 0 14px rgba(0,212,255,0.55), 0 0 32px rgba(0,212,255,0.20)",
        "neon-green":   "0 0 14px rgba(0,255,148,0.55), 0 0 32px rgba(0,255,148,0.20)",
        "neon-blue-sm": "0 0 8px  rgba(0,212,255,0.45), 0 0 16px rgba(0,212,255,0.15)",
        "neon-green-sm":"0 0 8px  rgba(0,255,148,0.45), 0 0 16px rgba(0,255,148,0.15)",
        "neon-purple":  "0 0 14px rgba(168,85,247,0.5), 0 0 28px rgba(168,85,247,0.18)",
      },
      animation: {
        "glow-blue":  "glow-blue  3s ease-in-out infinite",
        "glow-green": "glow-green 3s ease-in-out infinite",
        "slide-up":   "slide-up  0.18s ease-out",
        "fade-in":    "fade-in   0.2s ease-out",
      },
      keyframes: {
        "glow-blue": {
          "0%,100%": { boxShadow: "0 0 8px rgba(0,212,255,0.3), 0 0 16px rgba(0,212,255,0.1)" },
          "50%":     { boxShadow: "0 0 22px rgba(0,212,255,0.7), 0 0 44px rgba(0,212,255,0.25)" },
        },
        "glow-green": {
          "0%,100%": { boxShadow: "0 0 8px rgba(0,255,148,0.3), 0 0 16px rgba(0,255,148,0.1)" },
          "50%":     { boxShadow: "0 0 22px rgba(0,255,148,0.7), 0 0 44px rgba(0,255,148,0.25)" },
        },
        "slide-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to:   { transform: "translateY(0)",   opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
