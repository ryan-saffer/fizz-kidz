import { Navigate, useLocation } from 'react-router-dom'

/**
 * The base route goes to the dashboard. Zoho CRM's web tab opens our links as `https://…?/dashboard/bookings?…`, with
 * the page in the query, so a query that starts with a portal path goes to that page (and its own query) instead.
 */
export function RootRedirect() {
    const { search } = useLocation()
    const page = /^\?\/(?!\/)/.test(search) ? search.slice(1) : 'dashboard'
    return <Navigate to={page} replace />
}
