/**
 * Image dimensions are based on the replica's actual CSS slots, not on the
 * source files' natural dimensions. Nib uses `data-nib-width` for the layout
 * dimensions and `data-nib-widths` for the responsive transform ladder.
 */
export const imageSizing = {
  photoCard: {
    width: 480,
    widths: '240, 320, 480',
    sizes: 'auto, (min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  },
  artCard: {
    width: 332,
    widths: '192, 240, 320, 480, 640',
    sizes: '(min-width: 1072px) 20.75rem, (min-width: 1024px) calc(33.333vw - 1.667rem), (min-width: 640px) calc(50vw - 2rem), calc(50vw - 1.25rem)',
  },
  pinCard: {
    width: 180,
    widths: '160, 240',
    sizes: '180px',
  },
} as const
