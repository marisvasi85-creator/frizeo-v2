/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        frz: {
          ink: "#0b0b0c",
          "ink-soft": "#1c1f24",
          muted: "#5b6573",
          steel: "#3d4a5c",
          mist: "#e8eef5",
          fog: "#f3f6fa",
          line: "#d5dde8",
          accent: "#1f6feb",
          "accent-soft": "#dbeafe",
          success: "#15803d",
          "success-soft": "#dcfce7",
          danger: "#dc2626",
          "danger-soft": "#fef2f2",
        },
      },
      boxShadow: {
        frz: "0 1px 2px rgba(11, 11, 12, 0.04)",
      },
    },
  },
  plugins: [],
};
