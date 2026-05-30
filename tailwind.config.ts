import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm neutrals — washi paper whites, concrete grays
        surface: {
          50: '#faf9f7',   // page background — warm off-white
          100: '#f5f3f0',  // card hover
          200: '#ebe8e4',  // borders
          300: '#dbd7d1',  // dividers
        },
        // Rich charcoals — not pure black
        ink: {
          900: '#1a1a1a',  // primary text
          700: '#3d3d3d',  // secondary text
          500: '#6b6b6b',  // tertiary
          400: '#8a8a8a',  // muted
          300: '#a8a8a8',  // placeholder
          200: '#c9c9c9',  // disabled
        },
        // Cool indigo accent — precise, architectural
        accent: {
          50: '#f0f1ff',
          100: '#e0e3ff',
          200: '#c7cbfe',
          300: '#a5a9fc',
          400: '#8185f7',
          500: '#6366f1',  // primary accent
          600: '#4f46e5',  // hover
          700: '#4338ca',  // active
          800: '#3730a3',
          900: '#312e81',
        },
        slate: {
          925: '#0c1222',
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        'micro': ['10px', { lineHeight: '1.4', fontWeight: '500' }],
        'caption': ['11px', { lineHeight: '1.4', fontWeight: '500' }],
        'body': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'subtitle': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        'display-lg': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '400' }],
        'display': ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '400' }],
        'heading': ['1.125rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '500' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'elevated': '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.5)',
        'premium': '0 0 0 1px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04)',
        'premium-hover': '0 0 0 1px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.06)',
        'glow-indigo': '0 0 20px rgba(99, 102, 241, 0.15)',
        'sidebar': '4px 0 24px rgba(0,0,0,0.12)',
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #312e81 0%, #4338ca 40%, #6366f1 100%)',
        'gradient-hero-soft': 'linear-gradient(135deg, rgba(49,46,129,0.04) 0%, rgba(99,102,241,0.06) 100%)',
        'gradient-card': 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #1a1a2e 0%, #16162a 50%, #0f0f1e 100%)',
        'gradient-accent': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'gradient-success': 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        'gradient-warning': 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
        'gradient-danger': 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'counter': 'counter 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
export default config
