import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { listTerminals } from '../terminals'

const square = vi.hoisted(() => ({ devices: { codes: { list: vi.fn() } } }))
vi.mock('@/app/init/firebase', () => ({ env: 'prod' }))
vi.mock('@/integrations/square/square.client', () => ({ SquareClient: { getInstance: async () => square } }))

beforeEach(() => vi.clearAllMocks())

describe('listing terminals', () => {
    it("lists each paired terminal once, even when it's been paired more than once", async () => {
        square.devices.codes.list.mockResolvedValue([
            { deviceId: 'terminal-1', name: 'Balwyn' },
            { deviceId: 'terminal-1', name: 'Balwyn again' },
            { deviceId: undefined, name: 'never used' },
        ])
        expect(await listTerminals('location')).toEqual([{ deviceId: 'terminal-1', name: 'Balwyn' }])
        expect(square.devices.codes.list).toHaveBeenCalledWith({
            locationId: 'location',
            productType: 'TERMINAL_API',
            status: 'PAIRED',
        })
    })
})
