import { Image } from '@briansunter/nib-images'
import hero from '../hero.png?nib-image'

export default function ImagePage() {
  return <Image src={hero} alt="A generated test image" layout="full" priority />
}
