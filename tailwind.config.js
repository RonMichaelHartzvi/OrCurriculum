/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        blush: '#FFF1F5',
        petal: '#FCE7F3',
        rose: '#F9A8D4',
        berry: '#DB2777',
        cream: '#FFF9F5',
        mauve: '#F5D0E4',
        deepRose: '#BE185D'
      },
      fontFamily: {
        display: ['"Quicksand"', 'system-ui', 'sans-serif'],
        body: ['"Nunito"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        petal: '0 10px 30px -12px rgba(219, 39, 119, 0.25)',
        soft: '0 4px 20px -8px rgba(219, 39, 119, 0.15)'
      },
      borderRadius: {
        '4xl': '2rem'
      }
    }
  },
  plugins: []
}
