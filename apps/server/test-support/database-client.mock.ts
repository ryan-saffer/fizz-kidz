import { vi } from 'vite-plus/test'

import type {
    Booking,
    FirestoreBooking,
    InventoryCategory,
    InventoryItem,
    InventoryStockLevel,
    InventoryStockMovement,
    InventoryUsageRule,
    Studio,
    StudioOrMaster,
} from '@fizz-kidz/core'

type GetPartyBookingsForCapacityReportInput = { startDate: Date; endDate: Date; studio: StudioOrMaster }
type SetInventoryDocumentsInput = {
    items?: InventoryItem[]
    stockLevels?: InventoryStockLevel[]
    stockMovements?: InventoryStockMovement[]
    usageRules?: InventoryUsageRule[]
}
type RunInventoryStockTransactionInput = {
    location: Studio
    itemIds: string[]
    idempotencyKey?: string
    buildWrites: (input: {
        items: Map<string, InventoryItem>
        stockLevels: Map<string, InventoryStockLevel>
        createMovementId: (itemId: string) => string
        now: Date
    }) => { stockLevel: InventoryStockLevel; movement: InventoryStockMovement }[]
}

type MockDatabaseClient = {
    getPartyBookingsForCapacityReport: (input: GetPartyBookingsForCapacityReportInput) => Promise<FirestoreBooking[]>
    listPartyBookingsForInventoryShoppingList: (input: {
        startDate: Date
        endDate: Date
        location?: Studio
    }) => Promise<{ id: string; booking: Booking }[]>
    createInventoryItemId: () => Promise<string>
    setInventoryDocuments: (input: SetInventoryDocumentsInput) => Promise<void>
    getInventoryItem: (itemId: string) => Promise<InventoryItem>
    listInventoryItems: (input?: {
        includeArchived?: boolean
        category?: InventoryCategory
    }) => Promise<InventoryItem[]>
    updateInventoryItem: (itemId: string, item: Partial<InventoryItem>) => Promise<void>
    deleteInventoryDocuments: (input: {
        itemIds?: string[]
        stockLevelIds?: string[]
        stockMovementIds?: string[]
    }) => Promise<void>
    getInventoryStockLevel: (input: { location: Studio; itemId: string }) => Promise<InventoryStockLevel | undefined>
    updateInventoryStockLevel: (input: {
        location: Studio
        itemId: string
        stockLevel: Partial<InventoryStockLevel>
    }) => Promise<void>
    listInventoryStockLevels: (input?: { location?: Studio; itemId?: string }) => Promise<InventoryStockLevel[]>
    listInventoryStockMovements: (input?: {
        location?: Studio
        itemId?: string
        limit?: number
    }) => Promise<InventoryStockMovement[]>
    listInventoryStockMovementsForBooking: (bookingId: string) => Promise<InventoryStockMovement[]>
    runInventoryStockTransaction: (
        input: RunInventoryStockTransactionInput
    ) => Promise<{ stockLevel: InventoryStockLevel; movement: InventoryStockMovement }[]>
    listInventoryUsageRules: (input?: { includeArchived?: boolean }) => Promise<InventoryUsageRule[]>
    createInventoryUsageRuleId: () => Promise<string>
    getInventoryUsageRule: (ruleId: string) => Promise<InventoryUsageRule>
    deleteInventoryUsageRule: (ruleId: string) => Promise<void>
}

const databaseClientMocks = vi.hoisted(() => {
    const unmockedMethod = (methodName: string) => async () => {
        throw new Error(`DatabaseClient.${methodName} mock has not been configured for this test.`)
    }

    const mockDatabaseClient: MockDatabaseClient = {
        getPartyBookingsForCapacityReport: unmockedMethod('getPartyBookingsForCapacityReport'),
        listPartyBookingsForInventoryShoppingList: unmockedMethod('listPartyBookingsForInventoryShoppingList'),
        createInventoryItemId: unmockedMethod('createInventoryItemId'),
        setInventoryDocuments: unmockedMethod('setInventoryDocuments'),
        getInventoryItem: unmockedMethod('getInventoryItem'),
        listInventoryItems: unmockedMethod('listInventoryItems'),
        updateInventoryItem: unmockedMethod('updateInventoryItem'),
        deleteInventoryDocuments: unmockedMethod('deleteInventoryDocuments'),
        getInventoryStockLevel: unmockedMethod('getInventoryStockLevel'),
        updateInventoryStockLevel: unmockedMethod('updateInventoryStockLevel'),
        listInventoryStockLevels: unmockedMethod('listInventoryStockLevels'),
        listInventoryStockMovements: unmockedMethod('listInventoryStockMovements'),
        listInventoryStockMovementsForBooking: unmockedMethod('listInventoryStockMovementsForBooking'),
        runInventoryStockTransaction: unmockedMethod('runInventoryStockTransaction'),
        listInventoryUsageRules: unmockedMethod('listInventoryUsageRules'),
        createInventoryUsageRuleId: unmockedMethod('createInventoryUsageRuleId'),
        getInventoryUsageRule: unmockedMethod('getInventoryUsageRule'),
        deleteInventoryUsageRule: unmockedMethod('deleteInventoryUsageRule'),
    }

    return { mockDatabaseClient, unmockedMethod }
})

vi.mock('@/integrations/firebase/database.client', () => ({ DatabaseClient: databaseClientMocks.mockDatabaseClient }))

export const mockDatabaseClient = databaseClientMocks.mockDatabaseClient
const { unmockedMethod } = databaseClientMocks

export function resetDatabaseClientMock() {
    mockDatabaseClient.getPartyBookingsForCapacityReport = unmockedMethod('getPartyBookingsForCapacityReport')
    mockDatabaseClient.listPartyBookingsForInventoryShoppingList = unmockedMethod(
        'listPartyBookingsForInventoryShoppingList'
    )
    mockDatabaseClient.createInventoryItemId = unmockedMethod('createInventoryItemId')
    mockDatabaseClient.setInventoryDocuments = unmockedMethod('setInventoryDocuments')
    mockDatabaseClient.getInventoryItem = unmockedMethod('getInventoryItem')
    mockDatabaseClient.listInventoryItems = unmockedMethod('listInventoryItems')
    mockDatabaseClient.updateInventoryItem = unmockedMethod('updateInventoryItem')
    mockDatabaseClient.deleteInventoryDocuments = unmockedMethod('deleteInventoryDocuments')
    mockDatabaseClient.getInventoryStockLevel = unmockedMethod('getInventoryStockLevel')
    mockDatabaseClient.updateInventoryStockLevel = unmockedMethod('updateInventoryStockLevel')
    mockDatabaseClient.listInventoryStockLevels = unmockedMethod('listInventoryStockLevels')
    mockDatabaseClient.listInventoryStockMovements = unmockedMethod('listInventoryStockMovements')
    mockDatabaseClient.listInventoryStockMovementsForBooking = unmockedMethod('listInventoryStockMovementsForBooking')
    mockDatabaseClient.runInventoryStockTransaction = unmockedMethod('runInventoryStockTransaction')
    mockDatabaseClient.listInventoryUsageRules = unmockedMethod('listInventoryUsageRules')
    mockDatabaseClient.createInventoryUsageRuleId = unmockedMethod('createInventoryUsageRuleId')
    mockDatabaseClient.getInventoryUsageRule = unmockedMethod('getInventoryUsageRule')
    mockDatabaseClient.deleteInventoryUsageRule = unmockedMethod('deleteInventoryUsageRule')
}
