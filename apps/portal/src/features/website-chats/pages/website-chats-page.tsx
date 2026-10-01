import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { MessagesSquare, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useTRPC } from '@integrations/trpc'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@shared/components/ui/alert-dialog'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Skeleton } from '@shared/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'

// The server deletes in one Firestore batch, which holds up to 500 writes.
const DELETE_BATCH_SIZE = 500

/** Every website chat with Frankie, newest first. Opening a row shows the full transcript. */
export function WebsiteChatsPage() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { data: chats, isPending, isError } = useQuery(trpc.websiteChats.list.queryOptions())
    const { mutateAsync: deleteChats, isPending: isDeleting } = useMutation(trpc.websiteChats.delete.mutationOptions())

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

    const allIds = chats?.map((chat) => chat.id) ?? []
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
    const isSomeSelected = selectedIds.size > 0 && !isAllSelected

    function toggleSelected(id: string, isSelected: boolean) {
        setSelectedIds((current) => {
            const next = new Set(current)
            if (isSelected) next.add(id)
            else next.delete(id)
            return next
        })
    }

    function toggleAll(isSelected: boolean) {
        setSelectedIds(isSelected ? new Set(allIds) : new Set())
    }

    async function deleteSelected() {
        const ids = [...selectedIds]
        try {
            for (let index = 0; index < ids.length; index += DELETE_BATCH_SIZE) {
                await deleteChats({ ids: ids.slice(index, index + DELETE_BATCH_SIZE) })
            }
            toast.success(ids.length === 1 ? 'Transcript deleted.' : `${ids.length} transcripts deleted.`)
            setSelectedIds(new Set())
        } catch (err) {
            console.error(err)
            toast.error('Unable to delete transcripts.')
        } finally {
            setIsConfirmingDelete(false)
            await queryClient.invalidateQueries({ queryKey: trpc.websiteChats.list.queryKey() })
        }
    }

    return (
        <div className="twp min-h-[calc(100vh-4rem)] bg-slate-100 px-4 py-8 sm:px-8">
            <div className="flex w-full flex-col gap-6">
                <header className="flex flex-wrap items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">
                        <MessagesSquare className="h-6 w-6 text-violet-700" />
                    </span>
                    <div className="flex-1">
                        <h1 className="font-lilita text-3xl font-normal text-slate-900">Chat transcripts</h1>
                        <p className="text-slate-600">Every conversation with Frankie on the website.</p>
                    </div>
                    {selectedIds.size > 0 && (
                        <Button variant="destructive" onClick={() => setIsConfirmingDelete(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete {selectedIds.size === 1 ? 'transcript' : `${selectedIds.size} transcripts`}
                        </Button>
                    )}
                </header>

                <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
                    {isPending ? (
                        <div className="flex flex-col gap-3 p-6">
                            {Array.from({ length: 6 }, (_, index) => (
                                <Skeleton key={index} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : isError ? (
                        <p className="p-6 text-slate-600">Unable to load chat transcripts.</p>
                    ) : chats.length === 0 ? (
                        <p className="p-6 text-slate-600">No conversations yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10">
                                        <Checkbox
                                            checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                                            onCheckedChange={(checked) => toggleAll(checked === true)}
                                            aria-label="Select all transcripts"
                                        />
                                    </TableHead>
                                    <TableHead>Started</TableHead>
                                    <TableHead>First message</TableHead>
                                    <TableHead>Page</TableHead>
                                    <TableHead className="text-right">Messages</TableHead>
                                    <TableHead>Outcome</TableHead>
                                    <TableHead>Model</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {chats.map((chat) => (
                                    <TableRow
                                        key={chat.id}
                                        className="cursor-pointer"
                                        data-state={selectedIds.has(chat.id) ? 'selected' : undefined}
                                        onClick={() => navigate(chat.id)}
                                    >
                                        {/* Ticking a row selects it without opening the transcript. */}
                                        <TableCell onClick={(event) => event.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.has(chat.id)}
                                                onCheckedChange={(checked) => toggleSelected(chat.id, checked === true)}
                                                aria-label="Select transcript"
                                            />
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {format(new Date(chat.startedAt), 'd MMM yyyy, h:mm a')}
                                        </TableCell>
                                        <TableCell className="max-w-xl truncate text-slate-700">
                                            {chat.preview || <span className="text-slate-400">No messages</span>}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-slate-600">
                                            {chat.entryPage ?? '-'}
                                        </TableCell>
                                        <TableCell className="text-right">{chat.messageCount}</TableCell>
                                        <TableCell>
                                            {chat.enquirySubmitted ? (
                                                <Badge>Enquiry sent</Badge>
                                            ) : chat.status === 'active' ? (
                                                <Badge variant="outline">In progress</Badge>
                                            ) : (
                                                <Badge variant="secondary">No enquiry</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-slate-600">{chat.model}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </section>
            </div>

            <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {selectedIds.size === 1 ? 'this transcript' : `${selectedIds.size} transcripts`}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the {selectedIds.size === 1 ? 'conversation' : 'conversations'} and
                            can&apos;t be undone. Any enquiries already sent to Zoho aren&apos;t affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeleting}
                            onClick={(event) => {
                                event.preventDefault()
                                void deleteSelected()
                            }}
                        >
                            {isDeleting ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
