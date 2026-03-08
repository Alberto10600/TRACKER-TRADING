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
          primary: '#0a0e1a',
          secondary: '#0f1629',
          tertiary: '#1a2235',
          card: '#141d2e',
          hover: '#1e2d45',
        },
        accent: {
          blue: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
        },
        profit: '#10b981',
        loss: '#ef4444',
        neutral: '#f59e0b',
        border: '#1e2d45',
        text: {
          primary: '#e2e8f0',
          secondary: '#94a3b8',
          muted: '#475569',
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
