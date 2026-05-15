/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./script.js"],
  theme: {
    extend: {
      colors: {
        bg:         "#FAF7F2",
        card:       "#FFFFFF",
        ink:        "#1C1917",
        muted:      "#78716C",
        subtle:     "#E7E5E4",
        accent:     "#C2410C",
        accentSoft: "#FED7AA",
        danger:     "#B91C1C",
        warn:       "#B45309",
      },
      fontFamily: {
        sans:  ["Inter", "system-ui", "sans-serif"],
        serif: ['"Instrument Serif"', "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,25,23,0.04), 0 2px 8px rgba(28,25,23,0.04)",
        ring: "0 0 0 3px rgba(194,65,12,0.18)",
      },
    },
  },
  plugins: [],
};
