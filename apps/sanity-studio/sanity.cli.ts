import { fileURLToPath } from 'node:url'

import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
    studioHost: 'fizz-kidz',
    api: {
        projectId: 'rjsv3y4b',
        dataset: 'production',
    },
    deployment: {
        appId: 'm4vbp1pm5jkc6warczk5ptg0',
        autoUpdates: true,
    },
    vite: {
        resolve: {
            alias: {
                '@fizz-kidz/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
            },
        },
    },
})
