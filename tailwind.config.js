/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#102a43', deep: '#071a2b' },
        paper: '#f6f1e8',
        surface: '#fffdf8',
        sand: '#d8c4a5',
        teal: '#168a8a',
        olive: '#718355',
        signal: {
          red: '#d95d39',
          amber: '#d99b32',
          green: '#32866b',
          blue: '#3978a8',
        },
        line: '#c9bda9',
        muted: '#66788a',
      },
      fontFamily: {
        display: ['Fraunces', 'DM Serif Display', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,42,67,0.06), 0 1px 8px rgba(16,42,67,0.04)',
        raised: '0 8px 28px rgba(7,26,43,0.16)',
      },
      fontSize: {
        '2xs': ['0.6875rem', '1rem'],
      },
    },
  },
  plugins: [],
};
