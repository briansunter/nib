import { Image, type ImageProps } from '../src/index'
import { createImageSource } from '../src/image-source'

const source = createImageSource({
  __nibImage: true,
  __nibFile: '/fixture.jpg',
  __nibSourceId: '0123456789abcdef01234567',
  __nibStem: 'fixture',
  width: 100,
  height: 50,
  format: 'jpeg',
  hasAlpha: false,
  animated: false,
  fingerprint: 'fixture',
})

const valid: ImageProps = { src: source, alt: 'Fixture', layout: 'fixed', width: 50 }
const validQuality: ImageProps = { src: source, alt: 'Fixture', quality: { avif: 45, jpeg: 80 } }
void valid
void validQuality
void Image

// @ts-expect-error alt is required.
const missingAlt: ImageProps = { src: source }
// @ts-expect-error fixed images use density descriptors rather than sizes.
const fixedSizes: ImageProps = { src: source, alt: 'Fixture', layout: 'fixed', width: 50, sizes: '100vw' }
// @ts-expect-error full images never have a fixed width.
const fullWidth: ImageProps = { src: source, alt: 'Fixture', layout: 'full', width: 50 }
// @ts-expect-error priority owns loading.
const priorityLoading: ImageProps = { src: source, alt: 'Fixture', priority: true, loading: 'lazy' }
// @ts-expect-error the optimizer owns srcSet.
const reservedSrcSet: ImageProps = { src: source, alt: 'Fixture', srcSet: 'bad 1w' }
// @ts-expect-error static images do not accept event handlers.
const eventHandler: ImageProps = { src: source, alt: 'Fixture', onClick: () => undefined }
// @ts-expect-error PNG fallback is lossless and has no visual quality control.
const pngQuality: ImageProps = { src: source, alt: 'Fixture', quality: { png: 50 } }
void missingAlt
void fixedSizes
void fullWidth
void priorityLoading
void reservedSrcSet
void eventHandler
void pngQuality
