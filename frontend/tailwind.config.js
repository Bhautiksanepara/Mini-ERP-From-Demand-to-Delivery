/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        enterprise: {
          ink: '#1d2733',
          muted: '#65758a',
          shell: '#eef2f6',
          sidebar: '#1e2b37',
          blue: '#0f6cbd',
          blueDark: '#0b5cab',
          line: '#d8e1eb'
        }
      },
      boxShadow: {
        panel: '0 18px 50px rgb(15 23 42 / 10%)'
      }
    }
  },
  plugins: []
};
