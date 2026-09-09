/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F3E9',
        paperline: '#DCD3B8',
        ink: '#23282B',
        inkfaint: '#6B6459',
        ochre: '#B8863B',
        ochredark: '#8F6526',
        sage: '#7A9471',
        clay: '#B5533C',
      },
      fontFamily: {
        serif: ['"Lora"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
