/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: 'hsl(0 0% 6%)',
        foreground: 'hsl(0 0% 95%)',
        card: {
          DEFAULT: 'hsl(0 0% 8%)',
          foreground: 'hsl(0 0% 95%)',
        },
        popover: {
          DEFAULT: 'hsl(0 0% 8%)',
          foreground: 'hsl(0 0% 95%)',
        },
        primary: {
          DEFAULT: 'hsl(0 0% 18%)',
          foreground: 'hsl(0 0% 95%)',
        },
        secondary: {
          DEFAULT: 'hsl(0 0% 12%)',
          foreground: 'hsl(0 0% 95%)',
        },
        muted: {
          DEFAULT: 'hsl(0 0% 12%)',
          foreground: 'hsl(0 0% 60%)',
        },
        accent: {
          DEFAULT: 'hsl(43 50% 45%)',
          foreground: 'hsl(0 0% 95%)',
          faint: 'hsl(43 50% 38%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 62.8% 50%)',
          foreground: 'hsl(0 0% 95%)',
        },
        border: 'hsl(0 0% 12%)',
        input: 'hsl(0 0% 12%)',
        ring: 'hsl(0 0% 40%)',
      },
    },
  },
  plugins: [],
};
