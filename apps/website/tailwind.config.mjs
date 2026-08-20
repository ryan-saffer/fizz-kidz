import { withUt } from 'uploadthing/tw'

import fizzUiPreset from '@fizz-kidz/ui/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default withUt({
    darkMode: ['class'],
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}', '../../packages/ui/src/**/*.{js,jsx,ts,tsx}'],
    prefix: '',
    presets: [fizzUiPreset],
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px',
            },
        },
        extend: {
            boxShadow: {
                'purple-lg': '-50px 50px 0px -1px rgba(232,219,253,0.71)',
                'purple-md': '-25px 25px 0px -1px rgba(232,219,253,0.71)',
                'purple-sm': '-10px 10px 0px -1px rgba(232,219,253,0.71)',
                'blue-lg': '-50px 50px 0px -1px rgba(215, 246, 253, 0.81)',
                'blue-md': '-25px 25px 0px -1px rgba(215, 246, 253, 0.81)',
                'blue-sm': '-10px 10px 0px -1px rgba(215, 246, 253, 0.81)',
                'pink-lg': '-50px 50px 0px -1px rgba(242, 77, 162, 0.2)',
                'pink-md': '-25px 25px 0px -1px rgba(242, 77, 162, 0.2)',
                'pink-sm': '-10px 10px 0px -1px rgba(242, 77, 162, 0.2)',
                'green-lg': '-50px 50px 0px -1px rgba(78, 216, 95, 0.2)',
                'green-md': '-25px 25px 0px -1px rgba(78, 216, 95, 0.2)',
                'green-sm': '-10px 10px 0px -1px rgba(78, 216, 95, 0.2)',
                'gold-lg': '-50px 50px 0px -1px rgb(197, 179, 88, 0.2)',
                'gold-md': '-25px 25px 0px -1px rgb(197, 179, 88, 0.2)',
                'gold-sm': '-10px 10px 0px -1px rgb(197, 179, 88, 0.2)',
            },
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
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
            },
        },
    },
    plugins: [require('tailwindcss-animate'), require('@tailwindcss/container-queries')],
})
