import { RolePermissionMap, type Permission, type WebsiteChat } from '@fizz-kidz/core'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'

const PREVIEW_LENGTH = 120

/** Every website chat, newest first, for the Portal's transcripts table. */
export async function listWebsiteChatTranscripts(uid: string) {
    await assertWebsiteChatPermission(uid, 'website-chats:read')
    const chats = await DatabaseClient.listWebsiteChats()
    return chats.map(toSummary)
}

/** One website chat with its full transcript. */
export async function getWebsiteChatTranscript(id: string, uid: string) {
    await assertWebsiteChatPermission(uid, 'website-chats:read')
    const chat = await DatabaseClient.getWebsiteChat(id)
    if (!chat) throwTrpcError('NOT_FOUND', `website chat '${id}' not found`)
    return { ...toSummary(chat), messages: chat.messages }
}

/** Permanently deletes transcripts. A Firestore batch holds up to 500 writes, which the router enforces. */
export async function deleteWebsiteChatTranscripts(ids: string[], uid: string) {
    await assertWebsiteChatPermission(uid, 'website-chats:delete')
    await DatabaseClient.deleteWebsiteChats(ids)
    return { deleted: ids.length }
}

// Transcripts hold customers' contact details, so only super-admins can read or delete them.
async function assertWebsiteChatPermission(uid: string, permission: Permission) {
    const user = await DatabaseClient.getUser(uid)
    const isAllowed =
        user?.accountType === 'staff' &&
        Object.values(user.roles ?? {}).some((role) => RolePermissionMap[role].includes(permission))
    if (!isAllowed) throwTrpcError('FORBIDDEN', `website chats require '${permission}' permission`)
}

function toSummary(chat: WebsiteChat) {
    const firstMessage = chat.messages.find((message) => message.role === 'customer')?.text ?? ''
    return {
        id: chat.id,
        status: chat.status,
        model: chat.model,
        entryPage: chat.entryPage,
        startedAt: chat.startedAt.toISOString(),
        lastMessageAt: chat.lastMessageAt.toISOString(),
        messageCount: chat.messageCount,
        enquirySubmitted: chat.enquirySubmitted,
        preview: firstMessage.length > PREVIEW_LENGTH ? `${firstMessage.slice(0, PREVIEW_LENGTH)}…` : firstMessage,
    }
}
