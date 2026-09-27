import { beforeEach, describe, expect, it } from 'vitest'
import { err, ok } from '../lib/result'
import { notifyOnError, useToasts } from './toasts'

const toasts = () => useToasts.getState().toasts

beforeEach(() => {
  useToasts.getState().clear()
})

describe('useToasts', () => {
  it('pushes a message, defaulting to the error tone', () => {
    useToasts.getState().push('Something went wrong.')
    expect(toasts()).toHaveLength(1)
    expect(toasts()[0]).toMatchObject({
      message: 'Something went wrong.',
      tone: 'error',
    })
  })

  it('keeps several at once, in order', () => {
    useToasts.getState().push('First')
    useToasts.getState().push('Second')
    expect(toasts().map((t) => t.message)).toEqual(['First', 'Second'])
  })

  it('gives each one a distinct id', () => {
    const a = useToasts.getState().push('First')
    const b = useToasts.getState().push('Second')
    expect(a).not.toBe(b)
  })

  it('dismisses one without touching the others', () => {
    const first = useToasts.getState().push('First')
    useToasts.getState().push('Second')

    useToasts.getState().dismiss(first)

    expect(toasts().map((t) => t.message)).toEqual(['Second'])
  })

  it('ignores a dismiss for something already gone', () => {
    useToasts.getState().push('Only')
    useToasts.getState().dismiss('not-a-real-id')
    expect(toasts()).toHaveLength(1)
  })
})

describe('notifyOnError', () => {
  it('says nothing on success', () => {
    const failed = notifyOnError(ok({ id: 'task-1' }))
    expect(failed).toBe(false)
    expect(toasts()).toHaveLength(0)
  })

  it('shows the store’s own message on failure', () => {
    const failed = notifyOnError(err('FORBIDDEN', 'You cannot change that list.'))
    expect(failed).toBe(true)
    expect(toasts()[0].message).toBe('You cannot change that list.')
  })

  it('reports failure so the caller can branch on it', () => {
    expect(notifyOnError(err('NOT_FOUND', 'Gone.'))).toBe(true)
    expect(notifyOnError(ok(1))).toBe(false)
  })
})
