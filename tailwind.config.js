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
        // Los azules son los del logo: el navy del wordmark y el azul de
        // las caras del hexágono. El eléctrico que había antes (#2F6BFF)
        // no está en ninguna parte de la marca.
        brand: {
          50: '#EEF3FA',
          100: '#D5E2F1',
          300: '#7BA3CE',
          500: '#2E5EA6',
          600: '#234A85',
          700: '#1B3B6F'
        },
        // El turquesa se queda, pero solo con un trabajo: decir que algo
        // salió bien (aceptado, confirmado). De adorno ya no se usa.
        teal: {
          400: '#4ADAC0',
          500: '#26D0B0',
          600: '#189B84'
        },
        // El cobre y el dorado del hexágono. Es el segundo color de la
        // marca: donde antes había turquesa de adorno, ahora va esto.
        brass: {
          400: '#E2BE8B',
          500: '#C08A5E',
          600: '#9A6B45'
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
