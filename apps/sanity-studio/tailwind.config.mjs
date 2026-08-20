import fizzUiPreset from '@fizz-kidz/ui/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./components/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
    corePlugins: {
        preflight: false,
    },
    presets: [fizzUiPreset],
}
