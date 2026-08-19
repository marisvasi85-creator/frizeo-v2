/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        frz: {
          ink: "var(--frz-ink)",
          "ink-soft": "var(--frz-ink-soft)",
          muted: "var(--frz-muted)",
          steel: "var(--frz-steel)",
          mist: "var(--frz-mist)",
          fog: "var(--frz-fog)",
          line: "var(--frz-line)",
          accent: "var(--frz-accent)",
          "accent-soft": "var(--frz-accent-soft)",
          success: "var(--frz-success)",
          "success-soft": "var(--frz-success-soft)",
          danger: "var(--frz-danger)",
          "danger-soft": "var(--frz-danger-soft)",
          "ink-contrast": "var(--frz-ink-contrast)",
          bg: "var(--frz-bg)",
          card: "var(--frz-card)",
          overlay: "var(--frz-overlay)",
        },
      },
      boxShadow: {
        frz: "var(--frz-shadow)",
      },
    },
  },
  plugins: [],
};
