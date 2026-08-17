export function getApplicationDomain(environment: 'prod' | 'dev', useEmulator: boolean) {
    if (useEmulator) {
        return 'http://localhost:3000'
    }

    return environment === 'prod' ? 'https://bookings.fizzkidz.com.au' : 'https://dev.fizzkidz.com.au'
}
