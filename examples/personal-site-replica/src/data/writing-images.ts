import type { ImageSource } from '@briansunter/nib-images'

import centralPacific from '../assets/site-assets/68d32d0a-a41f-4370-bf64-60dacba7e3ea.jpeg?nib-image'
import convocardsLaunchRetro from '../assets/site-assets/convocards-launch-retro/image.jpg?nib-image'
import issue16 from '../assets/site-assets/1713157492098_0.png?nib-image'
import issue15 from '../assets/site-assets/hawaii-cover_1710985966457_0.jpg?nib-image'
import issue14 from '../assets/site-assets/Screenshot_2023-09-27_at_1.28.29_PM_1695857318835_0.png?nib-image'
import issue13 from '../assets/site-assets/coffee_quality_by_country_boxplot.png?nib-image'
import issue12 from '../assets/site-assets/Screenshot_2023-03-14_at_3.01.45_PM_1678842139677_0.png?nib-image'
import issue11 from '../assets/site-assets/honolulu_1676694313546_0.jpg?nib-image'
import issue10 from '../assets/site-assets/Screenshot_2023-02-02_at_1.42.14_PM_1675381393942_0.png?nib-image'

/** Cover sources for the nine posts shown on the homepage. */
export const writingImageMap: Record<string, ImageSource> = {
  'central-pacific-update': centralPacific,
  'convocards-launch-retro': convocardsLaunchRetro,
  'newsletter/issue-16': issue16,
  'newsletter/issue-15': issue15,
  'newsletter/issue-14': issue14,
  'newsletter/issue-13': issue13,
  'newsletter/issue-12': issue12,
  'newsletter/issue-11': issue11,
  'newsletter/issue-10': issue10,
}
