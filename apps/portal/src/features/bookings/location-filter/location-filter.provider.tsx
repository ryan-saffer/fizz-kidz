import { useEffect, useState } from 'react'

import { useOrg } from '@session/use-org'

import { FilterContext } from './location-filter.context'

import type { LocationFilter } from './location-filter.context'
import type { ReactNode } from 'react'

export function FilterContextProvider({ children }: { children: ReactNode }) {
    const { currentOrg } = useOrg()
    const [selectedLocation, setSelectedLocation] = useState<LocationFilter>(() => {
        if (currentOrg && currentOrg !== 'master') return currentOrg
        const initialLocation = window.localStorage.getItem('selectedLocation')
        return initialLocation ? (initialLocation as LocationFilter) : 'all'
    })

    useEffect(() => {
        if (!currentOrg || currentOrg === 'master') return
        if (selectedLocation !== currentOrg) setSelectedLocation(currentOrg)
        if (window.localStorage.getItem('selectedLocation') !== currentOrg) {
            window.localStorage.setItem('selectedLocation', currentOrg)
        }
    }, [currentOrg, selectedLocation])

    const filterByLocation = (location: LocationFilter) => {
        setSelectedLocation(location)
        window.localStorage.setItem('selectedLocation', location)
    }

    return (
        <FilterContext
            value={{
                selectedLocation,
                filterByLocation,
            }}
        >
            {children}
        </FilterContext>
    )
}
