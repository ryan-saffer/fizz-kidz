import type { FranchiseOrMaster, StudioOrMaster } from '@fizz-kidz/core'

import type { ClientStatus } from '@/shared/lazy-client/client-status'
import type { XeroClient as TXeroClient } from 'xero-node'

const ENV_MAP: Record<FranchiseOrMaster, { clientId: string; clientSecret: string }> = {
    master: {
        clientId: process.env.MASTER_XERO_CLIENT_ID,
        clientSecret: process.env.MASTER_XERO_CLIENT_SECRET,
    },
    balwyn: {
        clientId: process.env.BALWYN_XERO_CLIENT_ID,
        clientSecret: process.env.BALWYN_XERO_CLIENT_SECRET,
    },
    kingsville: {
        clientId: process.env.KINGSVILLE_XERO_CLIENT_ID,
        clientSecret: process.env.KINGSVILLE_XERO_CLIENT_SECRET,
    },
    werribee: {
        clientId: process.env.WERRIBEE_XERO_CLIENT_ID,
        clientSecret: process.env.WERRIBEE_XERO_CLIENT_SECRET,
    },
}

export class XeroClient {
    private static instances: Partial<Record<StudioOrMaster, XeroClient>> = {}
    #status: ClientStatus = 'not-initialised'

    #client: TXeroClient | null = null
    #refreshing = false

    private constructor() {}

    static async getInstance(studio: FranchiseOrMaster) {
        if (!XeroClient.instances[studio]) {
            XeroClient.instances[studio] = new XeroClient()
            await XeroClient.instances[studio].#initialise(studio)
        }
        while (XeroClient.instances[studio].#status === 'initialising') {
            await new Promise((resolve) => setTimeout(resolve, 20))
        }
        if (!XeroClient.instances[studio].#client) {
            throw new Error('Xero client not initialised')
        }
        // Ensure we have a valid token before returning the client
        await XeroClient.instances[studio].#ensureValidToken()
        return XeroClient.instances[studio].#client
    }

    async #initialise(studio: FranchiseOrMaster) {
        this.#status = 'initialising'
        try {
            const { XeroClient: _XeroClient } = await import('xero-node')
            this.#client = new _XeroClient({
                clientId: ENV_MAP[studio].clientId,
                clientSecret: ENV_MAP[studio].clientSecret,
                grantType: 'client_credentials',
            })

            const tokenSet = await this.#client.getClientCredentialsToken()
            this.#client.setTokenSet(tokenSet)
        } catch (err) {
            throw { message: 'error initialising xero api', error: err }
        }
        this.#status = 'initialised'
    }

    async #ensureValidToken() {
        if (!this.#client) return
        if (this.#refreshing) {
            // If another call is already refreshing, wait briefly
            // to let it complete to avoid duplicate requests.
            let attempts = 0
            while (this.#refreshing && attempts < 50) {
                await new Promise((r) => setTimeout(r, 20))
                attempts++
            }
            return
        }

        try {
            const tokenSet = this.#client.readTokenSet()
            const nowS = Math.floor(Date.now() / 1000)
            const expS = tokenSet.expires_at
            // Refresh a little early to avoid edge races
            const earlyRefreshBufferS = 60
            const isAboutToExpire = expS ? nowS >= expS - earlyRefreshBufferS : false

            if (isAboutToExpire || tokenSet.expired()) {
                this.#refreshing = true
                try {
                    const newTokenSet = await this.#client.getClientCredentialsToken()
                    this.#client.setTokenSet(newTokenSet)
                } finally {
                    this.#refreshing = false
                }
            }
        } catch (_err) {
            // If reading token failed for any reason, try to fetch a fresh one
            this.#refreshing = true
            try {
                const newTokenSet = await this.#client.getClientCredentialsToken()
                this.#client.setTokenSet(newTokenSet)
            } finally {
                this.#refreshing = false
            }
        }
    }
}
