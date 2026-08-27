/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#07090D", // Deep pitch black canvas
        surface: {
          DEFAULT: "#0D1117", // Base card surface
          subtle: "#131822", // Hover states & secondary containers
          elevated: "#1A212D", // Modals, popovers, dropdown menus
          border: "rgba(255, 255, 255, 0.08)",
          "border-strong": "rgba(255, 255, 255, 0.16)",
        },
        brand: {
          emerald: "#00F5A0", // Primary accent
          cyan: "#00D2FF", // Secondary gradient accent
          amber: "#FFB800", // Warning / threshold alert
          red: "#FF4D4D", // Circuit tripped / halted
          violet: "#8B5CF6", // Execution step indicator
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#94A3B8",
          muted: "#64748B",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      boxShadow: {
        "glow-emerald": "0 0 50px -10px rgba(0, 245, 160, 0.15)",
        "glow-cyan": "0 0 50px -10px rgba(0, 210, 255, 0.15)",
        "glow-red": "0 0 50px -10px rgba(255, 77, 77, 0.18)",
        "card-border": "inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)",
      },
      backgroundImage: {
        "radial-hero":
          "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(0, 245, 160, 0.18), rgba(0, 210, 255, 0.08), transparent 70%)",
        "radial-footer":
          "radial-gradient(ellipse 50% 50% at 50% 120%, rgba(0, 245, 160, 0.12), transparent 70%)",
        "grid-faint":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fade-up 0.5s ease-out both",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};
