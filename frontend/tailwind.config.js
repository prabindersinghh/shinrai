/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",
        stage: "#F6F7F9",
        wash: "#FAFAFB",
        ink: { DEFAULT: "#141414", 2: "#3A3D45", 3: "#5C616C" },
        muted: "#7A808C",
        line: { DEFAULT: "#E4E5E9", strong: "#CDD0D6" },
        hinomaru: { DEFAULT: "#E3122B", deep: "#B70D21", soft: "#FDECEE", wash: "#FFF6F7" },
        verified: { DEFAULT: "#15803D", soft: "#E9F7EE" },
        caution: { DEFAULT: "#C2410C", soft: "#FFF1E7" },
        amber: { DEFAULT: "#D97706", soft: "#FEF5E6" },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans JP", "system-ui", "sans-serif"],
        jp: ["Noto Sans JP", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        display: ["Bebas Neue", "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(20,20,20,0.04), 0 1px 2px rgba(20,20,20,0.06)",
        lift: "0 12px 32px -12px rgba(20,20,20,0.18)",
        seal: "0 0 0 1px rgba(227,18,43,0.25), 0 10px 30px -8px rgba(227,18,43,0.45)",
      },
      keyframes: {
        pulseRing: { "0%": { transform: "scale(0.8)", opacity: "0.7" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        pulseRing: "pulseRing 1.6s cubic-bezier(0.2,0.6,0.3,1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
