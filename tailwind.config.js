/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f0e0d',
          secondary: '#181614',
          tertiary: '#201e1b',
          card: '#1c1a17',
          hover: '#272421',
        },
        accent: {
          blue: '#6366f1',
          purple: '#818cf8',
          cyan: '#a78bfa',
        },
        profit: '#22c55e',
        loss: '#f04444',
        neutral: '#d97706',
        border: '#2e2b27',
        text: {
          primary: '#ede9e3',
          secondary: '#9e9890',
          muted: '#5c5650',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
