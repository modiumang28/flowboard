import { describe, expect, it } from 'vitest'
import { err, isError, ok } from './result'

describe('result', () => {
  it('wraps success values', () => {
    const result = ok(42)
    expect(isError(result)).toBe(false)
    expect(result).toEqual({ data: 42 })
  })

  it('produces the error shape the brief requires', () => {
    const result = err('FORBIDDEN', 'You do not have access to this list.')
    expect(isError(result)).toBe(true)
    expect(result).toEqual({
      error: { code: 'FORBIDDEN', message: 'You do not have access to this list.' },
    })
  })
})
