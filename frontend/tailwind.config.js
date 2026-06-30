/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fintech: {
          bg: '#0B0B14',
          card: '#151525',
          primary: '#5E5CE6',
          primaryHover: '#4D4BC8',
          accent: '#30D158',
          accentHover: '#24B142',
          danger: '#FF453A',
          warning: '#FF9F0A',
          neutral: '#8E8E93',
          border: '#24243B',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
