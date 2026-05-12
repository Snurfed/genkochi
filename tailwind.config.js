/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        japanese: {
          red: '#BC002D',
          white: '#FFFFFF',
        },
        genre: {
          mystery: '#6B21A8',
          romance: '#DB2777',
          comedy: '#F59E0B',
          horror: '#1F2937',
          scifi: '#0891B2',
          fairytale: '#059669',
        }
      },
    },
  },
  plugins: [],
}
