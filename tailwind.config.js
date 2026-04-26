/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    '!./node_modules/**',
    '!./dist/**',
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        "background-dark": "rgb(var(--color-background) / <alpha-value>)",
        "surface-dark": "rgb(var(--color-surface) / <alpha-value>)",
        "surface-dark-highlight": "rgb(var(--color-surface-highlight) / <alpha-value>)",
        "text-main-dark": "rgb(var(--color-text-main) / <alpha-value>)",
        "text-sub-dark": "rgb(var(--color-text-sub) / <alpha-value>)",
        "border-dark": "rgb(var(--color-border) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Chakra Petch", "sans-serif"],
        body: ["var(--font-body)"],
        admin: ["Manrope", "sans-serif"],
      },
      boxShadow: {
        'glow': '0 0 15px rgba(14, 165, 233, 0.3)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.3)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.3)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
