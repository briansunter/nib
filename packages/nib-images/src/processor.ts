import fs from 'node:fs/promises'
import sharp from 'sharp'
import type { ImageFormat, InternalImageSource, SourceImageFormat } from './image-source'

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
  if (format === 'avif') return pipeline.avif({ quality }).toBuffer()
  if (format === 'webp') return pipeline.webp({ quality }).toBuffer()
  if (format === 'png') return pipeline.png({ quality, compressionLevel: 9 }).toBuffer()
  return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()
}

export function sourcePipeline(source: InternalImageSource) {
  return sharp(source.__nibFile, { limitInputPixels: 100_000_000 }).rotate()
}

export async function transformFromPipeline(
  pipeline: sharp.Sharp,
  width: number,
  format: ImageFormat,
  quality: number,
): Promise<Buffer> {
  const resized = pipeline.resize({ width, withoutEnlargement: true })
  if (format === 'avif') return resized.avif({ quality }).toBuffer()
  if (format === 'webp') return resized.webp({ quality }).toBuffer()
  if (format === 'png') return resized.png({ quality, compressionLevel: 9 }).toBuffer()
  return resized.jpeg({ quality, mozjpeg: true }).toBuffer()
}
