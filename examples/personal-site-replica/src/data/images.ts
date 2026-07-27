import type { ImageSource } from '@briansunter/nib-images'
import avatar from '../assets/avatar.jpg?nib-image'
import bitcoinQrCode from '../assets/site-assets/bitcoin/bitcoin-qr-code.svg?nib-image'

import convocardsCover from '../assets/images/curated/convocards.png?nib-image'
import cuckootimerCover from '../assets/images/curated/cuckootimer.png?nib-image'
import logseq_gpt3_pluginCover from '../assets/images/curated/logseq-gpt3-plugin.png?nib-image'
import logseq_mcpCover from '../assets/images/curated/logseq-mcp.png?nib-image'
import logseq_youtube_captionsCover from '../assets/images/curated/logseq-youtube-captions.png?nib-image'
import personal_siteCover from '../assets/images/curated/personal-site.png?nib-image'
import pizzaplanCover from '../assets/images/curated/pizzaplan.png?nib-image'
import tracerCover from '../assets/images/curated/tracer.png?nib-image'

export const imageMap: Record<string, ImageSource> = {
  avatar,
  'convocards': convocardsCover,
  'cuckootimer': cuckootimerCover,
  'logseq-gpt3-plugin': logseq_gpt3_pluginCover,
  'logseq-mcp': logseq_mcpCover,
  'logseq-youtube-captions': logseq_youtube_captionsCover,
  'personal-site': personal_siteCover,
  'pizzaplan': pizzaplanCover,
  'tracer': tracerCover,
}

export const featuredProjectSlugs = ["convocards","cuckootimer","logseq-gpt3-plugin","logseq-mcp","logseq-youtube-captions","personal-site","pizzaplan","tracer"]

export { avatar }
export { bitcoinQrCode }
