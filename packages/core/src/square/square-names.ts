/**
 * A Square name without the staff-facing tags at its start, e.g. '[OLD PRICE][NO FOOD] 2 Hour Party' becomes
 * '2 Hour Party'. The tags tell staff variations apart in Square; customers don't need them.
 */
export function withoutSquareTags(name: string) {
    return name.replace(/^(\s*\[[^\]]*\])+\s*/, '')
}
