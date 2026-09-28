import { useState } from 'react'

/**
 * The value, or the last value it had once it's cleared. A dialog opened by a value then keeps its content on screen
 * through its close animation instead of emptying as it closes.
 */
export function useWhileClosing<T>(value: T | null) {
    const [last, setLast] = useState(value)
    if (value !== null && value !== last) setLast(value)
    return value ?? last
}
