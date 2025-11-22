/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./src/client/index.html",
    "./src/client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
      },
      colors: {
        'primary-light': 'var(--primary-light)',
        'primary-dark': 'var(--primary-dark)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateX(-50%) translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
      }
    },
  },
  plugins: [],
}