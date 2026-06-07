/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'cyber-blue': '#0a0e27',
        'cyber-dark': '#1a1f3a',
        'cyber-cyan': '#00f5ff',
        'cyber-fuchsia': '#bf00ff',
        'cyber-slate': '#e0e7ff',
      },
      fontFamily: {
        'display': ['Orbitron', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { 'background-position': '200% 0' },
          '100%': { 'background-position': '-200% 0' },
        },
        glow: {
          '0%': { 'box-shadow': '0 0 5px rgba(0, 245, 255, 0.3), 0 0 10px rgba(0, 245, 255, 0.2)' },
          '100%': { 'box-shadow': '0 0 20px rgba(0, 245, 255, 0.6), 0 0 40px rgba(0, 245, 255, 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(0, 245, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 245, 255, 0.03) 1px, transparent 1px)",
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
