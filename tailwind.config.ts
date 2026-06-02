import type { Config } from 'tailwindcss';

// ── Paleta de marca Negozio ───────────────────────────────────
// Primary: índigo profundo  #1700a5
// Danger:  rojo puro        #ed0000
// Negro / blanco como neutros
// Accent verde solo para "COBRAR" (convención POS)

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary: índigo profundo ─────────────────────────
        primary: {
          50:  '#f0eeff',
          100: '#e2dcff',
          200: '#c7baff',
          300: '#a897ff',
          400: '#8a74ff',
          500: '#6c52f5',
          600: '#4e30dc',  // hover sobre botones
          700: '#1700a5',  // ← COLOR PRINCIPAL de marca
          800: '#12007d',
          900: '#0c0057',
          950: '#070030',
        },
        // ── Danger: rojo puro ────────────────────────────────
        danger: {
          50:  '#fff0f0',
          100: '#ffe0e0',
          200: '#ffc2c2',
          300: '#ff9999',
          400: '#ff5555',
          500: '#ff1a1a',
          600: '#ed0000',  // ← COLOR PRINCIPAL de alerta/error
          700: '#c40000',
          800: '#9c0000',
          900: '#740000',
          950: '#3d0000',
        },
        // ── Accent: verde para COBRAR / confirmar (POS) ──────
        accent: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // ── Caja / POS: dark theme ───────────────────────────
        caja: {
          bg:          '#09090e',
          surface:     '#111118',
          'surface-2': '#191924',
          border:      '#1d1d2b',
          muted:       '#3f3f5c',
          text:        '#e2e8f0',
        },
        // ── Dashboard: light theme ───────────────────────────
        dash: {
          bg:      '#f8fafc',
          surface: '#ffffff',
          border:  '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
