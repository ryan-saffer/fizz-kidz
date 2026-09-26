import path from 'node:path'
import { fileURLToPath } from 'node:url'

import autoprefixer from 'autoprefixer'
import tailwindcssAnimate from 'tailwindcss-animate'
import backgroundPatterns from 'tailwindcss-bg-patterns'
import { scopedPreflightStyles } from 'tailwindcss-scoped-preflight'

const portalDir = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [path.join(portalDir, '*.html'), path.join(portalDir, 'src/**/*.{ts,tsx,js,jsx}')],
    prefix: '',
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px',
            },
        },
        extend: {
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                success: {
                    DEFAULT: 'hsl(var(--success))',
                    foreground: 'hsl(var(--success-foreground))',
                },
                info: {
                    DEFAULT: 'hsl(var(--info))',
                    foreground: 'hsl(var(--info-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                sidebar: {
                    DEFAULT: 'hsl(var(--sidebar-background))',
                    foreground: 'hsl(var(--sidebar-foreground))',
                    primary: 'hsl(var(--sidebar-primary))',
                    'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
                    accent: 'hsl(var(--sidebar-accent))',
                    'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
                    border: 'hsl(var(--sidebar-border))',
                    ring: 'hsl(var(--sidebar-ring))',
                },
                fizz: {
                    purple: {
                        dark: '#9B3EEA',
                    },
                    yellow: {
                        DEFAULT: '#FFDC5D',
                    },
                    blue: {
                        DEFAULT: '#02D7F7',
                        hover: '#02c2de',
                    },
                },
                // customer-facing party form
                party: {
                    ink: '#302440',
                    muted: '#6e6279',
                    pink: '#a92c83',
                    'pink-dark': '#8c216b',
                    line: '#e7dfe9',
                    cream: '#fcfaf7',
                    tint: '#fcf6fc',
                    lilac: '#f1eaf6',
                    placeholder: '#eee6f3',
                },
            },
            backgroundImage: {
                'party-glow':
                    'radial-gradient(ellipse at 96% 5%, #eee4fa 0, transparent 38%), radial-gradient(ellipse at 0% 70%, #fce8ee 0, transparent 32%)',
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            keyframes: {
                'accordion-down': {
                    from: {
                        height: '0',
                    },
                    to: {
                        height: 'var(--radix-accordion-content-height)',
                    },
                },
                'accordion-up': {
                    from: {
                        height: 'var(--radix-accordion-content-height)',
                    },
                    to: {
                        height: '0',
                    },
                },
                grow: {
                    '0%': {
                        transform: 'scale(0)',
                    },
                    '100%': {
                        transform: 'scale(1)',
                    },
                },
                'party-enter': {
                    from: { opacity: '0', transform: 'translateY(8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                grow: 'grow 0.1s ease-in-out',
                'party-enter': 'party-enter 0.3s ease both',
            },
            fontFamily: {
                lilita: ['LilitaOne'],
                gotham: ['GothamLight'],
            },
            boxShadow: {
                purple: '-28px 24px 0px -1px rgba(232,219,253,0.81)',
            },
        },
    },
    plugins: [
        scopedPreflightStyles({
            cssSelector: '.twp',
            mode: 'matched only',
        }),
        autoprefixer,
        backgroundPatterns,
        // the enter/exit animations shadcn components use (animate-in, fade-in, slide-in-from-*...)
        tailwindcssAnimate,
        ({ addUtilities }) => {
            addUtilities({
                // a custom utility class to make screen full screen when within the dashboard.
                // this fixes a bug when opening the drawer, and 'h-full' seems to break.
                '.dashboard-full-screen': {
                    minHeight: 'calc(100vh - 64px)',
                },
            })
        },
    ],
}
