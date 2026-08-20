declare global {
    namespace NodeJS {
        interface ProcessEnv {
            FUNCTIONS_EMULATOR: 'true' | 'false'

            FIREBASE_CONFIG: string
            MIXPANEL_API_KEY: string
            SQUARE_TOKEN: string
            ACUITY_USER_ID: string
            ACUITY_API_KEY: string
            ESIGNATURES_SECRET: string
            GOOGLE_OAUTH_CLIENT_ID: string
            GOOGLE_OAUTH_CLIENT_SECRET: string
            GOOGLE_OAUTH_REFRESH_TOKEN: string
            GOOGLE_OAUTH_REDIRECT_URI: string
            PAPERFORM_API_TOKEN: string
            SEND_GRID_API_KEY: string
            SLING_PASSWORD: string
            ZOHO_CLIENT_ID: string
            ZOHO_CLIENT_SECRET: string
            ZOHO_REFRESH_TOKEN: string

            MASTER_XERO_CLIENT_ID: string
            MASTER_XERO_CLIENT_SECRET: string
            BALWYN_XERO_CLIENT_ID: string
            BALWYN_XERO_CLIENT_SECRET: string
            KINGSVILLE_XERO_CLIENT_ID: string
            KINGSVILLE_XERO_CLIENT_SECRET: string
            WERRIBEE_XERO_CLIENT_ID: string
            WERRIBEE_XERO_CLIENT_SECRET: string
        }
    }
}

export {}
