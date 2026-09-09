export {}

const TYPING_MS = 135
const BACKSPACE_MS = 75
const WORD_HOLD_MS = 800
const BETWEEN_WORDS_MS = 200
const FINISH_PAUSE_MS = 200

// Each mount owns its listeners, timers and observers, including Astro page transitions.
class HomeTypewriter extends HTMLElement {
    private timers: ReturnType<typeof setTimeout>[] = []
    private controller?: AbortController
    private observer?: IntersectionObserver
    private resizeObserver?: ResizeObserver
    private word?: HTMLElement
    private heading?: HTMLElement
    private line?: HTMLElement
    private words: string[] = []
    private started = false

    connectedCallback() {
        this.cleanup()
        const controller = new AbortController()
        this.controller = controller
        // On reconnect, custom elements can be upgraded before their children are parsed.
        queueMicrotask(() => {
            if (!controller.signal.aborted && this.isConnected) this.initialize(controller.signal)
        })
    }

    disconnectedCallback() {
        this.cleanup()
    }

    private initialize(signal: AbortSignal) {
        this.word = this.querySelector<HTMLElement>('[data-typed-word]') ?? undefined
        this.heading = this.querySelector<HTMLElement>('.home-heading') ?? undefined
        this.line = this.querySelector<HTMLElement>('.home-word-line') ?? undefined
        this.words = (this.dataset.words ?? '').split(',').filter(Boolean)
        if (!this.word || !this.heading || !this.line || !this.words.length) return

        const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
        this.dataset.wordIndex = '0'
        this.started = motion.matches
        if (motion.matches) {
            this.settle()
        } else {
            this.word.textContent = ''
            this.dataset.state = 'pending'
        }
        this.resizeObserver = new ResizeObserver(() => this.sizeWords())
        this.resizeObserver.observe(this.line)

        this.word.addEventListener(
            'animationend',
            (event) => {
                if (event.target !== this.word || motion.matches) return
                if (event.animationName === 'home-gold-sweep' && this.dataset.state === 'sweep') {
                    this.dataset.state = 'glow'
                } else if (event.animationName === 'home-gold-arrival-glow' && this.dataset.state === 'glow') {
                    this.dataset.state = 'shimmer'
                }
            },
            { signal }
        )
        motion.addEventListener(
            'change',
            () => {
                if (motion.matches) {
                    this.started = true
                    this.settle()
                }
            },
            { signal }
        )

        let headingFontReady = false
        const startWhenReady = () => {
            if (signal.aborted) return
            if (headingFontReady && this.dataset.inView === 'true' && !this.started && !motion.matches) {
                this.started = true
                this.sizeWords()
                this.play()
            }
        }
        this.observer = new IntersectionObserver(
            (entries) => {
                if (signal.aborted) return
                this.dataset.inView = String(entries.some((entry) => entry.isIntersecting))
                startWhenReady()
            },
            { threshold: 0.15 }
        )
        this.observer.observe(this)

        // Only the heading font gates typing, not Gotham, decorative fonts or React islands.
        void document.fonts
            .load('400 1em LilitaOne')
            .catch(() => [])
            .then(() => {
                if (signal.aborted) return
                headingFontReady = true
                this.sizeWords()
                startWhenReady()
            })
    }

    private sizeWords() {
        if (!this.line?.clientWidth || !this.heading || !this.word) return
        const context = document.createElement('canvas').getContext('2d')
        const prefix = this.querySelector<HTMLElement>('.home-lets')
        if (!context || !prefix) return
        const initialStyle = getComputedStyle(this.heading)
        const fontSize = parseFloat(initialStyle.fontSize)
        const spacingRatio = (parseFloat(initialStyle.letterSpacing) || 0) / fontSize
        const gapRatio = (parseFloat(initialStyle.columnGap) || 0) / fontSize
        context.font = `${initialStyle.fontWeight} 100px ${initialStyle.fontFamily}`
        const prefixText = prefix.textContent ?? ''
        const prefixRatio = context.measureText(prefixText).width / 100 + spacingRatio * prefixText.length
        const longestRatio = Math.max(
            ...this.words.map((word) => context.measureText(word).width / 100 + spacingRatio * word.length)
        )
        const horizontalPadding = parseFloat(initialStyle.paddingLeft) + parseFloat(initialStyle.paddingRight)
        const cursor = this.querySelector<HTMLElement>('.home-cursor')!
        const cursorStyle = getComputedStyle(cursor)
        const cursorSpace = parseFloat(cursorStyle.width) + parseFloat(cursorStyle.marginLeft)
        const available = this.heading.clientWidth - horizontalPadding - cursorSpace - 4
        const fitSize = Math.max(16, available / (prefixRatio + longestRatio + gapRatio))
        // Fit the entire line once for the longest word; never shrink only the changing word.
        this.heading.style.setProperty('--home-heading-fit-size', `${Math.floor(fitSize * 100) / 100}px`)

        const headingStyle = getComputedStyle(this.heading)
        const wordStyle = getComputedStyle(this.word)
        context.font = `${wordStyle.fontWeight} ${wordStyle.fontSize} ${wordStyle.fontFamily}`
        const finalWord = this.words[this.words.length - 1]!
        const finalWidth =
            context.measureText(finalWord).width + (parseFloat(wordStyle.letterSpacing) || 0) * finalWord.length
        const padding = parseFloat(headingStyle.paddingLeft) + parseFloat(headingStyle.paddingRight)
        const patchWidth = padding + prefix.offsetWidth + parseFloat(headingStyle.columnGap) + finalWidth + 4
        this.heading.style.setProperty(
            '--home-finished-patch-width',
            `${Math.min(this.heading.clientWidth, Math.ceil(patchWidth))}px`
        )
        this.heading.style.setProperty('--home-finished-word-width', `${Math.ceil(finalWidth)}px`)
    }

    private play() {
        this.clearTimers()
        this.dataset.state = 'typing'
        this.word!.textContent = ''
        let time = 0
        let finalCharacterAt = time
        for (const [index, word] of this.words.entries()) {
            for (let length = 1; length <= word.length; length++) {
                this.at(() => {
                    if (length === 1) this.dataset.wordIndex = String(index)
                    this.word!.textContent = word.slice(0, length)
                }, time)
                finalCharacterAt = time
                time += TYPING_MS
            }
            time += WORD_HOLD_MS
            if (index < this.words.length - 1) {
                for (let length = word.length - 1; length >= 0; length--) {
                    this.at(() => {
                        this.word!.textContent = word.slice(0, length)
                    }, time)
                    time += BACKSPACE_MS
                }
                time += BETWEEN_WORDS_MS
            }
        }
        this.at(() => {
            this.clearTimers()
            this.dataset.state = 'sweep'
        }, finalCharacterAt + FINISH_PAUSE_MS)
    }

    private at(callback: () => void, delay: number) {
        this.timers.push(setTimeout(callback, delay))
    }

    private settle() {
        this.clearTimers()
        if (this.word) this.word.textContent = this.words[this.words.length - 1]!
        this.dataset.state = 'settled'
    }

    private clearTimers() {
        this.timers.forEach(clearTimeout)
        this.timers = []
    }

    private cleanup() {
        this.controller?.abort()
        this.observer?.disconnect()
        this.resizeObserver?.disconnect()
        this.clearTimers()
    }
}

if (!customElements.get('home-typewriter')) customElements.define('home-typewriter', HomeTypewriter)
