/**
 * The Square ice-cream cake item drives the party form's cake step: its variations are the sizes, and its
 * modifier lists are the designs and flavours ($0) and the serving and candle options.
 */
export const PARTY_CAKE_SQUARE_CATALOG = {
    prod: {
        itemId: '45NPMQ7DBAK5B7BGOX3P7WZD',
        designListId: 'UJPDYQFRMVUDZNHBICVFYPTY',
        flavourListId: 'FADOVFX2OUNCRAK3GY6BIZBQ',
        servingListId: 'FUNJUOT6XNVAH6RYGVCDEAC3',
        candleListId: 'UAF5HX6RC4OJKDW7AQ5ULLUT',
        mediumSizeVariationId: 'YIB2F72Q4LDT4VO4SS72CNVK',
    },
    dev: {
        itemId: '3UIMHQZHPTFKCMDL62X6LADI',
        designListId: 'S2LRSB4QIUZ4Z22LKEBZQGJC',
        flavourListId: 'CWSOUQOTDD2WWVQDRT4AQBIZ',
        servingListId: 'K7KWRU5CY6HSRU26VC4GZQVB',
        candleListId: 'B5EGQRQ3UTHYDKXHBV6QKOTH',
        mediumSizeVariationId: '33R4W7BPZG5TXCB3IFRGT3AF',
    },
} as const satisfies Record<
    'prod' | 'dev',
    {
        itemId: string
        designListId: string
        flavourListId: string
        servingListId: string
        candleListId: string
        /** The only size studio-stock cakes (Geelong, Werribee) come in. */
        mediumSizeVariationId: string
    }
>
