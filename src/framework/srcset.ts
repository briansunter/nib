export interface SrcsetUrl {
  readonly start: number
  readonly end: number
  readonly value: string
}

function whitespace(character: string | undefined): boolean {
  return character !== undefined && /[\t\n\f\r ]/.test(character)
}

/**
 * Returns source URL ranges without treating the comma inside a data URL as a
 * candidate separator. Descriptor validation remains the browser's job.
 */
export function srcsetUrls(value: string): readonly SrcsetUrl[] {
  const urls: SrcsetUrl[] = []
  let position = 0
  while (position < value.length) {
    while (
      position < value.length
      && (whitespace(value[position]) || value[position] === ',')
    ) {
      position += 1
    }
    if (position >= value.length) break

    const start = position
    while (position < value.length && !whitespace(value[position])) position += 1
    let end = position
    while (end > start && value[end - 1] === ',') end -= 1
    if (end > start) {
      urls.push({ start, end, value: value.slice(start, end) })
    }

    // A trailing comma ended a descriptor-free candidate. Otherwise skip its
    // descriptors, respecting parentheses, until the next candidate comma.
    if (end !== position) continue
    let parentheses = 0
    while (position < value.length) {
      const character = value[position]
      position += 1
      if (character === '(') parentheses += 1
      else if (character === ')' && parentheses > 0) parentheses -= 1
      else if (character === ',' && parentheses === 0) break
    }
  }
  return urls
}
