/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          600: '#0a1628',
          700: '#081220',
          800: '#060e19',
          900: '#040b14',
          950: '#020709',
        },
        brand: {
          DEFAULT: '#1d6fa4',
          light:   '#2589c4',
          dark:    '#155880',
        },
        accent: '#00c2a8',
        warn:   '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
