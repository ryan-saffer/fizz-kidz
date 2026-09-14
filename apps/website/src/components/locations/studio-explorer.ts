import type { PUBLIC_STUDIOS } from '@/utils/studios'
import type { LatLng, Map as LeafletMap, Marker } from 'leaflet'

type MapStudio = (typeof PUBLIC_STUDIOS)[number]

class StudioExplorer extends HTMLElement {
    private map?: LeafletMap
    private markers = new Map<string, Marker>()
    private positions = new Map<string, LatLng>()
    private observer?: IntersectionObserver
    private resizeObserver?: ResizeObserver
    private controller?: AbortController
    private selected = 'balwyn'

    connectedCallback() {
        this.controller = new AbortController()
        const { signal } = this.controller
        const studios: MapStudio[] = JSON.parse(this.dataset.studios ?? '[]')
        this.querySelectorAll<HTMLButtonElement>('[data-studio-select]').forEach((button) => {
            button.hidden = false
            button.addEventListener('click', () => this.selectStudio(button.dataset.studioSelect!), { signal })
        })
        this.querySelectorAll<HTMLElement>('.studio-fallback-link').forEach((link) => {
            link.hidden = true
        })
        this.observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return
                this.observer?.disconnect()
                void this.loadMap(studios, signal)
            },
            { rootMargin: '200px' }
        )
        this.observer.observe(this)
    }

    private selectStudio(slug: string) {
        this.selected = slug
        this.querySelectorAll<HTMLButtonElement>('[data-studio-select]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.studioSelect === slug))
        })
        this.querySelectorAll<HTMLElement>('[data-studio-preview]').forEach((preview) => {
            preview.hidden = preview.dataset.studioPreview !== slug
        })
        this.markers.forEach((marker, key) => {
            marker.getElement()?.classList.toggle('is-selected', key === slug)
            marker.getElement()?.setAttribute('aria-pressed', String(key === slug))
            marker.setZIndexOffset(key === slug ? 1000 : 0)
        })
        const position = this.positions.get(slug)
        if (position && this.map) {
            const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
            this.map.panTo(position, { animate, duration: 0.65 })
        }
    }

    private async loadMap(studios: MapStudio[], signal: AbortSignal) {
        const container = this.querySelector<HTMLElement>('[data-map]')!
        const error = this.querySelector<HTMLElement>('[data-map-error]')!
        try {
            const L = await import('leaflet')
            if (signal.aborted) return
            const studioColour = getComputedStyle(this).getPropertyValue('--studio-colour').trim()
            container.replaceChildren()
            const map = L.map(container, {
                scrollWheelZoom: false,
                zoomControl: false,
                minZoom: 7,
                maxZoom: 18,
                zoomSnap: 0.25,
            })
            this.map = map
            L.control.zoom({ position: 'bottomright' }).addTo(map)
            const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            })
            tiles.on('tileerror', () => {
                error.hidden = false
            })
            tiles.addTo(map)
            const bounds = L.latLngBounds(studios.map((studio) => [studio.coordinates[0], studio.coordinates[1]]))
            const showAll = () => map.fitBounds(bounds, { padding: [65, 75], animate: false })
            showAll()

            // West-to-east entrances give the overview a quick sweep of colour.
            const ordered = [...studios].sort((a, b) => a.coordinates[1] - b.coordinates[1])
            ordered.forEach((studio, index) => {
                this.positions.set(studio.slug, L.latLng(studio.coordinates[0], studio.coordinates[1]))
                const pin = document.createElement('span')
                pin.className = 'studio-pin'
                pin.style.setProperty('--pin-delay', `${index * 100}ms`)
                const face = document.createElement('span')
                face.className = 'studio-pin-face'
                const logo = document.createElement('img')
                logo.src = this.dataset.logo!
                logo.alt = ''
                logo.width = 35
                logo.height = 39
                face.append(logo)
                const label = document.createElement('span')
                label.className = 'studio-pin-label'
                label.textContent = studio.name
                pin.append(face, label)
                const marker = L.marker([studio.coordinates[0], studio.coordinates[1]], {
                    icon: L.divIcon({
                        className: 'studio-map-marker',
                        html: pin,
                        iconSize: [52, 64],
                        iconAnchor: [26, 64],
                    }),
                    title: `Explore Fizz Kidz ${studio.name}`,
                    alt: `Explore Fizz Kidz ${studio.name}`,
                    keyboard: true,
                }).addTo(map)
                marker.on('click', () => this.selectStudio(studio.slug))
                const element = marker.getElement()
                element?.setAttribute('aria-label', `Explore Fizz Kidz ${studio.name}`)
                element?.setAttribute('aria-controls', 'studio-preview')
                element?.setAttribute('aria-pressed', String(studio.slug === this.selected))
                element?.classList.toggle('is-selected', studio.slug === this.selected)
                element?.addEventListener(
                    'keydown',
                    (event) => {
                        if (event.key === ' ') {
                            event.preventDefault()
                            this.selectStudio(studio.slug)
                        }
                    },
                    { signal }
                )
                this.markers.set(studio.slug, marker)
            })

            // Spread overlapping pins at overview zooms. Leader lines retain their
            // geographic anchors, and pins return to those anchors as you zoom in.
            const leaders = L.layerGroup().addTo(map)
            const arrangePins = () => {
                leaders.clearLayers()
                const placed: { x: number; y: number }[] = []
                const size = map.getSize()
                const northToSouth = [...studios].sort((a, b) => b.coordinates[0] - a.coordinates[0])
                // A compact overview needs reserved slots: a greedy placement can
                // leave the last Melbourne pin without enough room on a phone.
                const columns = size.x < 330 ? 2 : 3
                const rows = Math.ceil(studios.length / columns)
                const slots = Array.from({ length: rows * columns }, (_, index) =>
                    L.point(
                        55 + ((index % columns) * (size.x - 110)) / (columns - 1),
                        115 + (Math.floor(index / columns) * (size.y - 155)) / (rows - 1)
                    )
                )
                northToSouth.forEach((studio) => {
                    const anchor = this.positions.get(studio.slug)!
                    const origin = map.latLngToContainerPoint(anchor)
                    // Off-screen studios should stay off-screen when the visitor pans.
                    if (origin.x < 0 || origin.y < 0 || origin.x > size.x || origin.y > size.y) {
                        this.markers.get(studio.slug)!.setLatLng(anchor)
                        return
                    }
                    let point = origin
                    if (size.x < 550 && map.getZoom() < 11) {
                        slots.sort((a, b) => a.distanceTo(origin) - b.distanceTo(origin))
                        point = slots.shift()!
                    } else {
                        search: for (let radius = 0; radius <= 280; radius += 20) {
                            for (let step = 0; step < 16; step++) {
                                const angle = (step * Math.PI) / 8 - Math.PI / 2
                                const candidate = L.point(
                                    origin.x + Math.cos(angle) * radius,
                                    origin.y + Math.sin(angle) * radius
                                )
                                if (
                                    candidate.x < 52 ||
                                    candidate.x > size.x - 52 ||
                                    candidate.y < 115 ||
                                    candidate.y > size.y - 50
                                )
                                    continue
                                if (
                                    placed.some(
                                        (other) =>
                                            Math.abs(other.x - candidate.x) < 100 &&
                                            Math.abs(other.y - candidate.y) < 96
                                    )
                                )
                                    continue
                                point = candidate
                                break search
                            }
                        }
                    }
                    placed.push(point)
                    const position = map.containerPointToLatLng(point)
                    this.markers.get(studio.slug)!.setLatLng(position)
                    if (point.distanceTo(origin) > 5) {
                        L.polyline([anchor, position], {
                            color: studioColour,
                            weight: 2,
                            opacity: 0.8,
                            dashArray: '4 5',
                            interactive: false,
                        }).addTo(leaders)
                        L.circleMarker(anchor, {
                            radius: 4,
                            color: 'white',
                            weight: 2,
                            fillColor: studioColour,
                            fillOpacity: 1,
                            interactive: false,
                        }).addTo(leaders)
                    }
                })
            }
            map.on('moveend zoomend', arrangePins)
            arrangePins()

            this.resizeObserver = new ResizeObserver(() => {
                map.invalidateSize()
                showAll()
            })
            this.resizeObserver.observe(container)
        } catch {
            if (!signal.aborted) error.hidden = false
        }
    }

    disconnectedCallback() {
        this.controller?.abort()
        this.observer?.disconnect()
        this.resizeObserver?.disconnect()
        this.map?.remove()
        this.map = undefined
        this.markers.clear()
        this.positions.clear()
    }
}

if (!customElements.get('studio-explorer')) customElements.define('studio-explorer', StudioExplorer)
