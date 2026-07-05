import { describe, it, expect } from 'vitest'
import { parseMochiEntityUri, isMochiEntityUri, mochiEntityUri } from './mochi-uri'

describe('parseMochiEntityUri', () => {
  it('parses the 2-slash peer form', () => {
    const r = parseMochiEntityUri('mochi://12D3KooWPeer/1abcEntity')
    expect(r).toEqual({ entity: '1abcEntity', peer: '12D3KooWPeer', sub: [] })
  })
  it('parses sub-resources', () => {
    const r = parseMochiEntityUri('mochi://12D3KooWPeer/1abcEntity/1postId')
    expect(r).toEqual({ entity: '1abcEntity', peer: '12D3KooWPeer', sub: ['1postId'] })
  })
  it('parses the 1-slash session form (no peer)', () => {
    expect(parseMochiEntityUri('mochi:/1abcEntity')).toEqual({ entity: '1abcEntity', peer: '', sub: [] })
  })
  it('trims whitespace', () => {
    expect(parseMochiEntityUri('  mochi://P/E  ')?.entity).toBe('E')
  })
  it('rejects non-mochi and system-intent forms', () => {
    expect(parseMochiEntityUri('https://x/y')).toBeNull()
    expect(parseMochiEntityUri('mochi:notification?link=/x')).toBeNull() // 0-slash intent
    expect(parseMochiEntityUri('mochi://peerOnly')).toBeNull()           // authority, no entity
    expect(parseMochiEntityUri('1abcEntity')).toBeNull()                 // bare id, not a URI
  })
  it('isMochiEntityUri agrees', () => {
    expect(isMochiEntityUri('mochi://P/E')).toBe(true)
    expect(isMochiEntityUri('1abcEntity')).toBe(false)
  })
  it('builds the share URI', () => {
    expect(mochiEntityUri('12D3KooWPeer', '1abcEntity')).toBe('mochi://12D3KooWPeer/1abcEntity')
  })
})
