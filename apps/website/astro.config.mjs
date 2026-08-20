import { fileURLToPath } from 'node:url'

import netlify from '@astrojs/netlify'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
    site: 'https://www.fizzkidz.com.au',
    compressHTML: true,
    adapter: netlify({ imageCDN: false }),
    vite: {
        resolve: {
            alias: {
                '@fizz-kidz/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
                '@fizz-kidz/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
            },
        },
    },
    integrations: [
        react(),
        sitemap({
            filter: (page) => !page.endsWith('/form-result/'),
        }),
    ],
    redirects: {
        'play-lab': '/preschool-program',
        // TEMPORARY WHILE WE NO LONGER OFFER IN STUDIO SCIENCE
        'after-school-programs': '/in-schools/after-school-programs',
        // FROM OLD WEBSITE
        'in-store-parties': '/birthday-parties/',
        'glam-parties': '/birthday-parties/glam-parties/',
        scienceparties: '/birthday-parties/science-parties/',
        slimeparties: '/birthday-parties/slime-parties/',
        safariparties: '/birthday-parties/jungle-safari-parties/',
        'birthday-parties/safari-parties': '/birthday-parties/jungle-safari-parties/',
        'unicorn-parties': '/birthday-parties/unicorn-parties/',
        tiedyeparties: '/birthday-parties/tie-dye-parties/',
        'taylor-swift-party': '/birthday-parties/taylor-swift-parties/',
        'birthday-parties/k-pop-demon-hunters-parties': '/birthday-parties/k-pop-power-parties/',
        'mobile-parties': '/birthday-parties/at-home-parties/',
        'in-studio-after-school-programs': '/after-school-programs/',
        'in-studio-after-school-science-program/': '/after-school-programs/science-program/',
        'in-studio-after-school-art-program/': '/after-school-programs/art-and-makers-program/',
        'school-science': '/in-schools/after-school-programs/',
        'school-science-incursions': '/in-schools/incursions/',
        team: '/our-team/',
        'terms-and-conditions': '/policies/',
        'book-a-party': '/birthday-parties/book-a-party/',
        'privacy-policy': '/policies/#privacy',
        invitations: 'https://bookings.fizzkidz.com.au/invitations/',
        creations: '/birthday-parties/creations/',
    },
    image: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.sanity.io',
            },
            {
                protocol: 'https',
                hostname: '**.cdninstagram.com',
            },
        ],
    },
})
