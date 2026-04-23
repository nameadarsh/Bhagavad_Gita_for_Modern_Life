/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gita-orange': '#f97316',
        'gita-cream': '#fffbeb',
      }
    },
  },
  plugins: [],
}
