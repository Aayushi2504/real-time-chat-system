/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0b0e13',
          /** Main elevated panels (sidebar, drawers) */
          raised: '#10151c',
          /** Slightly lighter strip — headers, input dock */
          strip: '#141a24',
          /** Message list well */
          inset: '#0d1118',
          /** Cards, bubbles (incoming), avatars */
          elevated: '#1a2330',
          /** Hover / secondary controls */
          muted: '#242f3f',
          /** Hairline borders */
          border: '#2a3545',
        },
        accent: {
          DEFAULT: '#4f8cff',
          dim: '#3b7ae8',
          glow: 'rgba(79, 140, 255, 0.22)',
        },
      },
      boxShadow: {
        dock: '0 -1px 0 0 rgba(255,255,255,0.06)',
        header: '0 1px 0 0 rgba(255,255,255,0.06)',
        bubble: '0 1px 2px rgba(0,0,0,0.25)',
      },
      maxWidth: {
        chat: '52rem',
      },
    },
  },
  plugins: [],
};
