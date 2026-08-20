import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
    studioHost: 'fizz-kidz',
    api: {
        projectId: 'rjsv3y4b',
        dataset: 'production',
    },
    deployment: {
        autoUpdates: true,
    },
})
