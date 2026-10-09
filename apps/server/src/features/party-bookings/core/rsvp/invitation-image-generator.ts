import fs from 'fs'
import path from 'path'

import { createCanvas, loadImage, registerFont } from 'canvas'
import { DateTime } from 'luxon'
import QRCode from 'qrcode'

import type { Invitations, WithoutUid } from '@fizz-kidz/core'
import { ObjectKeys, getInvitationShareUrl, getStudioAddress } from '@fizz-kidz/core'

import type { PNGStream } from 'canvas'

import { env } from '@/app/init/firebase'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

export class InvitationImageGenerator {
    #invitation: WithoutUid<Invitations.Invitation>

    constructor(invitation: WithoutUid<Invitations.Invitation>) {
        this.#invitation = invitation
    }

    /**
     *
     * @param out the output path for the image
     */
    async generatePng(out: string) {
        registerFont(path.resolve(__dirname, './features/party-bookings/invitations/fonts/lilita-one.ttf'), {
            family: 'lilita',
        })
        registerFont(path.resolve(__dirname, './features/party-bookings/invitations/fonts/petit-cochon.ttf'), {
            family: 'petit-cochon',
        })
        const image = await loadImage(
            path.resolve(
                __dirname,
                `./features/party-bookings/invitations/${InvitationInfo[this.#invitation.invitation].filename}`
            )
        )

        const canvas = createCanvas(image.width, image.height)
        const ctx = canvas.getContext('2d')

        ctx.drawImage(image, 0, 0, image.width, image.height)

        ObjectKeys(InvitationInfo[this.#invitation.invitation].textInfo).map((key) => {
            const {
                font,
                textAlign,
                fillStyle,
                coords: { x, y },
            } = InvitationInfo[this.#invitation.invitation].textInfo[key]

            ctx.font = font
            ctx.fillStyle = fillStyle
            ctx.textAlign = textAlign
            ctx.textBaseline = 'middle'
            ctx.fillText(this.#getContent(key), x, y)
        })

        const qrCodeBuffer = await QRCode.toBuffer(getInvitationShareUrl(env, isUsingEmulator(), this.#invitation.id), {
            width: InvitationInfo[this.#invitation.invitation].qrCodeSize,
            color: { dark: '000000', light: InvitationInfo[this.#invitation.invitation].qrCodeColor },
            margin: 0,
        })
        const qrCodeImage = await loadImage(qrCodeBuffer)
        const qrCodePosition = InvitationInfo[this.#invitation.invitation].qrCodePosition
        ctx.drawImage(qrCodeImage, qrCodePosition.x, qrCodePosition.y)

        const stream = canvas.createPNGStream()
        const outputStream = fs.createWriteStream(out)

        return this.#asyncStream(stream, outputStream)
    }

    #asyncStream(stream: PNGStream, out: fs.WriteStream) {
        return new Promise<void>((resolve, reject) => {
            stream.pipe(out)
            out.on('finish', () => {
                resolve()
            })
            out.on('error', (err: any) => {
                console.error({ err })
                reject('error writing canvas to png')
            })
        })
    }

    #getContent(field: keyof InvitationCoordinates) {
        switch (field) {
            case 'childName': {
                return this.#formatChildsName(this.#invitation.childName, this.#invitation.childAge)
            }
            case 'date': {
                return DateTime.fromJSDate(this.#invitation.date, { zone: 'Australia/Melbourne' }).toFormat(
                    'dd/LL/yyyy'
                )
            }
            case 'time': {
                return this.#invitation.time
            }
            case 'rsvpLine1': {
                return `RSVP to ${this.#invitation.parentName} by ${DateTime.fromJSDate(this.#invitation.rsvpDate, {
                    zone: 'Australia/Melbourne',
                }).toFormat('dd/LL/yyyy')}`
            }
            case 'rsvpLine2': {
                return `by scanning here`
            }
            case 'address': {
                return this.#invitation.$type === 'studio'
                    ? getStudioAddress(this.#invitation.studio)
                    : this.#invitation.address
            }
            default: {
                const exhaustiveCheck: never = field
                throw new Error(`Unhandled field when getting invitation content for field: '${exhaustiveCheck}'`)
            }
        }
    }

    #formatChildsName(name: string, age: string) {
        if (name.endsWith('s')) {
            return `${name}' ${age}th`
        }
        return `${name}'s ${age}th`
    }
}

type Coords = { x: number; y: number }

type TextInfo = {
    font: string
    textAlign: 'left' | 'center'
    fillStyle: string
    coords: Coords
}

type InvitationCoordinates = {
    childName: TextInfo
    date: TextInfo
    time: TextInfo
    rsvpLine1: TextInfo
    rsvpLine2: TextInfo
    address: TextInfo
}

const InvitationInfo: Record<
    Invitations.InvitationOption,
    {
        filename: string
        textInfo: InvitationCoordinates
        qrCodePosition: { x: number; y: number }
        qrCodeSize: number
        qrCodeColor: string
    }
> = {
    'Kpop Demon Hunters': {
        filename: 'kpop-demon-hunters.png',
        qrCodePosition: { x: 1000, y: 1600 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#B14594',
                coords: { x: 705, y: 925 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 462, y: 1197 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 832, y: 1197 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1308 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1363 },
            },
            address: {
                font: '34px bold Open Sans Condensed Light',
                fillStyle: 'white',
                textAlign: 'center',
                coords: { x: 670, y: 1810 },
            },
        },
    },
    Freckles: {
        filename: 'freckles.png',
        qrCodePosition: { x: 900, y: 1550 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#4BC5D9',
                coords: { x: 700, y: 940 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 421, y: 1181 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 779, y: 1181 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1260 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1315 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 486, y: 1640 },
            },
        },
    },
    Stripes: {
        filename: 'stripes.png',
        qrCodePosition: { x: 952, y: 1590 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#4BC5D9',
                coords: { x: 705, y: 868 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 420, y: 1102 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 810, y: 1102 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1203 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1258 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 503, y: 1579 },
            },
        },
    },
    Dots: {
        filename: 'dots.png',
        qrCodePosition: { x: 1005, y: 1540 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '150px petit-cochon',
                textAlign: 'center',
                fillStyle: '#ABC954',
                coords: { x: 705, y: 890 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 463, y: 1126 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 824, y: 1126 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1264 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1319 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 582, y: 1761 },
            },
        },
    },
    'Glitz & Glam': {
        filename: 'glitz.png',
        qrCodePosition: { x: 1030, y: 1625 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#E71971',
                coords: { x: 705, y: 975 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 392, y: 1246 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 854, y: 1246 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1364 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1419 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 692, y: 1663 },
            },
        },
    },
    'Bubbling Fun': {
        filename: 'bubbling.png',
        qrCodePosition: { x: 1024, y: 1562 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#4BC5D9',
                coords: { x: 705, y: 900 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 470, y: 1145 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 840, y: 1145 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 720, y: 1264 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 720, y: 1314 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 612, y: 1570 },
            },
        },
    },
    'Bubbling Blue Fun': {
        filename: 'bubbling-blue.png',
        qrCodePosition: { x: 1035, y: 1634 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#3AB9CE',
                coords: { x: 705, y: 1021 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 443, y: 1259 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 811, y: 1259 },
            },
            rsvpLine1: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1348 },
            },
            rsvpLine2: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1403 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 671, y: 1664 },
            },
        },
    },
    'Slime Time': {
        filename: 'slime.png',
        qrCodePosition: { x: 1002, y: 1672 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#3AB9CE',
                coords: { x: 668, y: 1089 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 420, y: 1316 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 843, y: 1316 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 673, y: 1407 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 673, y: 1462 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 659, y: 1750 },
            },
        },
    },
    Swiftie: {
        filename: 'swift.png',
        qrCodePosition: { x: 1049, y: 1667 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#E71971',
                coords: { x: 708, y: 1080 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 436, y: 1335 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 856, y: 1335 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1433 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1488 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 705, y: 1801 },
            },
        },
    },
    'Tie Dye': {
        filename: 'tie-dye.png',
        qrCodePosition: { x: 1016, y: 1655 },
        qrCodeSize: 300,
        qrCodeColor: 'FFDC5D',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#3AB9CE',
                coords: { x: 710, y: 1040 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 429, y: 1302 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 842, y: 1302 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 718, y: 1420 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 718, y: 1475 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 670, y: 1689 },
            },
        },
    },
    Unicorn: {
        filename: 'unicorn.png',
        qrCodePosition: { x: 992, y: 1655 },
        qrCodeSize: 270,
        qrCodeColor: 'FFFFFF',
        textInfo: {
            childName: {
                font: '160px petit-cochon',
                textAlign: 'center',
                fillStyle: '#E71971',
                coords: { x: 725, y: 1065 },
            },
            date: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 399, y: 1412 },
            },
            time: {
                font: 'bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'left',
                coords: { x: 842, y: 1402 },
            },
            rsvpLine1: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 668, y: 1520 },
            },
            rsvpLine2: {
                font: 'italic bold 40px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 668, y: 1575 },
            },
            address: {
                font: 'bold 34px Open Sans Condensed Light',
                fillStyle: 'black',
                textAlign: 'center',
                coords: { x: 650, y: 1842 },
            },
        },
    },
}
