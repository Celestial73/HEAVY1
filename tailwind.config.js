/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#e5e7eb',
        panel: 'rgba(107, 114, 128, 0.45)',
        panelDark: 'rgba(31, 41, 55, 0.7)',
      },
      boxShadow: {
        heavy: '0 24px 60px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
