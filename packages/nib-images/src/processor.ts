import fs from 'node:fs/promises'
import sharp, { type Sharp } from 'sharp'
import type { ImageFormat, InternalImageSource, SourceImageFormat } from './image-source'

export const IMAGE_PROCESSOR_ID = [
  `sharp@${sharp.versions.sharp}`,
  `vips@${sharp.versions.vips}`,
  'avif-effort@2',
  'webp-effort@4',
  'jpeg-progressive',
  'png-lossless-compression@8',
].join(';')

function encode(pipeline: Sharp, format: ImageFormat, quality: number): Promise<Buffer> {
  if (format === 'avif') return pipeline.avif({ quality, effort: 2 }).toBuffer()
  if (format === 'webp') return pipeline.webp({ quality, effort: 4 }).toBuffer()
  if (format === 'png') {
    return pipeline.png({ compressionLevel: 8 }).toBuffer()
  }
  return pipeline.jpeg({ quality, progressive: true }).toBuffer()
}

export async function transformImage(
  source: InternalImageSource,
  width: number,
  format: ImageFormat | SourceImageFormat,
  quality: number,
  passthrough: boolean,
): Promise<Buffer> {
  if (passthrough || format === 'gif' || format === 'svg') return fs.readFile(source.__nibFile)
  const pipeline = sharp(source.__nibFile, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width, withoutEnlargement: true })
  return encode(pipeline, format, quality)
}

export function sourcePipeline(source: InternalImageSource) {
  return sharp(source.__nibFile, { limitInputPixels: 100_000_000 }).rotate()
}

export async function transformFromPipeline(
  pipeline: Sharp,
  width: number,
  format: ImageFormat,
  quality: number,
): Promise<Buffer> {
  const resized = pipeline.resize({ width, withoutEnlargement: true })
  return encode(resized, format, quality)
}
