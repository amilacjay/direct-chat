/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Tokens flip via [data-theme]; `dark:` variants also available if you want them.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // surfaces
        bg: 'var(--bg)',
        bg2: 'var(--bg-2)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        surfaceHi: 'var(--surface-hi)',
        // hairlines
        line: 'var(--border)',
        lineHi: 'var(--border-hi)',
        // text
        ink: {
          DEFAULT: 'var(--text)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
          4: 'var(--text-4)',
        },
        // brand
        accent: {
          DEFAULT: 'var(--accent)',
          hi: 'var(--accent-hi)',
          lo: 'var(--accent-lo)',
          soft: 'var(--accent-soft)',
          line: 'var(--accent-line)',
          ink: 'var(--on-accent)',
        },
        good: 'var(--good)',
        warn: 'var(--warn)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: 'var(--shadow-sm)',
        pop: 'var(--shadow-md)',
        float: 'var(--shadow-lg)',
        glow: 'var(--glow)',
      },
      keyframes: {
        msgIn: {
          from: { transform: 'translateY(9px) scale(.985)' },
          to: { transform: 'translateY(0) scale(1)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.45', transform: 'scale(.82)' },
        },
        ring: {
          '0%': { transform: 'scale(.6)', opacity: '.7' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        floatUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        typingBlink: {
          '0%,60%,100%': { opacity: '.25', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-3px)' },
        },
      },
      animation: {
        msgIn: 'msgIn .34s cubic-bezier(.2,.9,.3,1.2) both',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
        ring: 'ring 1.8s ease-out infinite',
        floatUp: 'floatUp .4s ease both',
      },
    },
  },
  plugins: [],
};
