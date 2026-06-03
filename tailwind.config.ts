import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e14",
        surface: "#151a23",
        "surface-2": "#1c2330",
        border: "#2a3343",
        accent: "#5b8cff",
        "accent-2": "#37d399",
        danger: "#ff5d6c",
        muted: "#8a94a6",
      },
    },
  },
  plugins: [],
};

export default config;
