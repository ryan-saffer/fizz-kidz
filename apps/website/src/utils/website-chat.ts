// The chat reply streams, so call the Functions URL directly. Firebase Hosting (bookings.fizzkidz.com.au) buffers streamed responses.
export const WEBSITE_CHAT_URL =
    import.meta.env.MODE === 'emulator'
        ? 'http://localhost:5001/booking-system-6435d/australia-southeast1/api/api/chat'
        : import.meta.env.MODE === 'prod'
          ? 'https://australia-southeast1-bookings-prod.cloudfunctions.net/api/api/chat'
          : 'https://australia-southeast1-booking-system-6435d.cloudfunctions.net/api/api/chat'

// Prototype: the chat is hidden from production builds and the model picker is only for testing.
export const IS_WEBSITE_CHAT_ENABLED = import.meta.env.MODE !== 'prod'
