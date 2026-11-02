/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        app: {
          base: '#090d12',
          surface: '#0f151d',
          card: '#151d28',
          cardHover: '#1c2635',
          border: '#232f40',
          borderLight: '#303f54',
          accent: '#f59e0b',
          live: '#10b981',
          danger: '#ef4444'
        },
        kast: { DEFAULT: '#7c3aed', light: '#a78bfa', deep: '#2e1065' }
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        'glow-accent': '0 0 15px -3px rgba(245, 158, 11, 0.3)',
        'glow-live': '0 0 15px -3px rgba(16, 185, 129, 0.35)',
        'glow-danger': '0 0 15px -3px rgba(239, 68, 68, 0.4)'
      }
    }
  },
  plugins: []
};
