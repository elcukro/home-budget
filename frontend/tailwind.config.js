/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      backgroundColor: {
        'background-primary': 'rgb(var(--background-primary))',
        'background-secondary': 'rgb(var(--background-secondary))',
        'card': 'rgb(var(--card-background))',
        'input': 'rgb(var(--input-background))',
      },
      textColor: {
        'primary': 'rgb(var(--text-primary))',
        'secondary': 'rgb(var(--text-secondary))',
      },
      borderColor: {
        'default': 'rgb(var(--border-color))',
      },
      colors: {
        navy: {
          800: '#1a2c4e',
          900: '#0f1a2e',
          950: '#070d17',
        },
      },
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
} 