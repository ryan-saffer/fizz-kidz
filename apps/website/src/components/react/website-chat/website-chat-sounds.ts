// Subtle chat sounds generated with the Web Audio API, so there are no audio files to load.
// Browsers only allow audio after a user gesture, so the context is created on the first send.

const MASTER_VOLUME = 0.35

let context: AudioContext | undefined
let master: GainNode | undefined

function getAudio() {
    try {
        if (!context) {
            context = new AudioContext()
            master = context.createGain()
            master.gain.value = MASTER_VOLUME
            master.connect(context.destination)
        }
        if (context.state === 'suspended') void context.resume()
        return { context, master: master! }
    } catch {
        // Audio can be unavailable (old browsers, strict privacy settings). The chat works without it.
        return undefined
    }
}

type Note = {
    type: OscillatorType
    from: number
    to?: number
    start: number
    duration: number
    volume: number
}

function playNote({ context, master }: { context: AudioContext; master: GainNode }, note: Note) {
    const startAt = context.currentTime + note.start
    const endAt = startAt + note.duration

    const oscillator = context.createOscillator()
    oscillator.type = note.type
    oscillator.frequency.setValueAtTime(note.from, startAt)
    if (note.to) oscillator.frequency.exponentialRampToValueAtTime(note.to, endAt)

    // A quick fade in and out avoids clicks.
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(note.volume, startAt + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt)

    oscillator.connect(gain).connect(master)
    oscillator.start(startAt)
    oscillator.stop(endAt + 0.02)
}

/** A soft, low "bloop" confirming the customer's message was sent. */
export function playSendSound() {
    const audio = getAudio()
    if (!audio) return
    playNote(audio, { type: 'sine', from: 520, to: 360, start: 0, duration: 0.09, volume: 0.18 })
}

/** The send sound in reverse: a single soft "bloop" rising, when Frankie starts replying. */
export function playReplySound() {
    const audio = getAudio()
    if (!audio) return
    playNote(audio, { type: 'sine', from: 360, to: 520, start: 0, duration: 0.09, volume: 0.18 })
}
