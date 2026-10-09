/**
 * Copies text to the clipboard.
 *
 * The Clipboard API is blocked when the portal runs inside a cross-origin iframe without `allow="clipboard-write"`
 * (e.g. the Zoho CRM web tab), so this falls back to the legacy `execCommand('copy')`, which still works there.
 */
export async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        textarea.remove()
        if (!copied) throw new Error('Could not copy to the clipboard. Please try again.')
    }
}
