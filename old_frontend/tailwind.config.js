/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base':        '#FAF8F3',
        'bg-panel':       '#F3EFE6',
        'bg-subtle':      '#EDE8DC',
        'border-soft':    '#D9D0BC',
        'border-strong':  '#BFB49A',
        'text-primary':   '#1C1A14',
        'text-secondary': '#5C5649',
        'text-muted':     '#9C937E',
        'saffron':        '#C8742A',
        'saffron-light':  '#F0D9BC',
        'saffron-subtle': '#FBF3EA',
        'user-bubble':    '#EDEAE2',
        'link':           '#7A5C38',
        'focus-ring':     '#C8742A',
      },
      fontFamily: {
        display: ['var(--font-cormorant-garamond)', 'Georgia', 'serif'],
        body:    ['var(--font-lora)', 'Georgia', 'serif'],
        verse:   ['var(--font-eb-garamond)', 'Georgia', 'serif'],
        devanagari: ['var(--font-noto-serif-devanagari)', 'serif'],
      },
    },
  },
  plugins: [],
}
