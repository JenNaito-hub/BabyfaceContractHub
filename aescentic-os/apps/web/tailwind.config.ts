import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141810",
        paper: "#F1F2EA",
        surface: "#FBFBF6",
        line: "#D6D9C8",
        muted: "#6A7059",
        accent: "#8FA004",
        chip: "#D7F205",
        danger: "#A8422A",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
