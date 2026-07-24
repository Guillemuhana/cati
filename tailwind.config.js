/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F6F2',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#14181C',
          soft: '#5B6570',
          faint: '#94998F'
        },
        line: '#E4E1D9',
        brand: {
          50: '#EAF0FF',
          100: '#CBD9FB',
          300: '#6E93F2',
          500: '#2F6BFF',
          600: '#1E4FD6',
          700: '#1B2A66'
        },
        teal: {
          400: '#4ADAC0',
          500: '#26D0B0',
          600: '#189B84'
        },
        brass: {
          400: '#C9A96A',
          500: '#B08D45',
          600: '#8F7237'
        },
        rust: {
          400: '#C77B63',
          500: '#B4483A'
        }
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Manrope"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,24,28,0.04), 0 8px 24px -12px rgba(20,24,28,0.12)',
        stamp: '0 2px 0 rgba(20,24,28,0.06)'
      },
      borderRadius: {
        xl2: '1.1rem'
      }
    }
  },
  plugins: []
}
