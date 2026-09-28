import { beforeEach, describe, expect, it } from 'vitest'
import { seededState, useStore } from './store'
import { descriptionSnippet, searchTasks, type SearchState } from './search'

let state: SearchState

beforeEach(() => {
  useStore.setState(seededState())
  state = useStore.getState()
})

const titles = (userId: string, query: string) =>
  searchTasks(state, userId, query).map((r) => r.task.title)

describe('searchTasks — matching', () => {
  it('matches on the title', () => {
    expect(titles('user-alice', 'checkout')).toContain('Fix crash on checkout')
  })

  it('matches on the description', () => {
    // "Happens on iOS 17 when the cart is empty."
    expect(titles('user-alice', 'iOS 17')).toContain('Fix crash on checkout')
  })

  it('ignores case', () => {
    expect(titles('user-alice', 'CHECKOUT')).toEqual(titles('user-alice', 'checkout'))
  })

  it('returns nothing for an empty or whitespace query', () => {
    expect(searchTasks(state, 'user-alice', '')).toEqual([])
    expect(searchTasks(state, 'user-alice', '   ')).toEqual([])
  })

  it('returns nothing when nothing matches', () => {
    expect(searchTasks(state, 'user-alice', 'zzzzz')).toEqual([])
  })

  it('searches across every list, not just one', () => {
    const lists = new Set(searchTasks(state, 'user-alice', 'a').map((r) => r.list.name))
    expect(lists.size).toBeGreaterThan(1)
  })

  it('reports which field matched', () => {
    const [byTitle] = searchTasks(state, 'user-alice', 'Fix crash on checkout')
    expect(byTitle.matchedIn).toBe('title')

    const [byBody] = searchTasks(state, 'user-alice', 'iOS 17')
    expect(byBody.matchedIn).toBe('description')
  })

  it('carries the list and status so a result can explain itself', () => {
    const [result] = searchTasks(state, 'user-alice', 'Fix crash on checkout')
    expect(result.list.name).toBe('Bugs')
    expect(result.status.name).toBe('Open')
  })
})

describe('searchTasks — ranking and limits', () => {
  it('puts title matches above description-only matches', () => {
    // "login" is in the title of one task and the description of another.
    const results = searchTasks(state, 'user-alice', 'login')
    const firstBody = results.findIndex((r) => r.matchedIn === 'description')
    const lastTitle = results.map((r) => r.matchedIn).lastIndexOf('title')

    if (firstBody !== -1 && lastTitle !== -1) {
      expect(lastTitle).toBeLessThan(firstBody)
    }
    expect(results[0].matchedIn).toBe('title')
  })

  it('caps how many come back', () => {
    // "e" appears in nearly every task.
    expect(searchTasks(state, 'user-alice', 'e', 3)).toHaveLength(3)
  })
})

describe('searchTasks — permissions', () => {
  it('hides results from a list the user is denied', () => {
    // "Fix crash on checkout" lives in Bugs, which Bob is denied.
    expect(titles('user-alice', 'checkout')).toContain('Fix crash on checkout')
    expect(titles('user-bob', 'checkout')).not.toContain('Fix crash on checkout')
  })

  it('hides results behind a private ancestor', () => {
    // Q3 Features is public, but sits inside the private Product space.
    expect(titles('user-alice', 'Loyalty')).toContain('Loyalty program')
    expect(titles('user-bob', 'Loyalty')).toEqual([])
  })

  it('shows them to a member who was granted access', () => {
    expect(titles('user-carol', 'Loyalty')).toContain('Loyalty program')
  })

  it('never returns more to a member than to the admin', () => {
    for (const query of ['a', 'e', 'fix', 'screen']) {
      const forAlice = new Set(titles('user-alice', query))
      for (const member of ['user-bob', 'user-carol']) {
        for (const title of titles(member, query)) {
          expect(forAlice.has(title)).toBe(true)
        }
      }
    }
  })

  it('gives Bob and Carol different results, as their grants differ', () => {
    expect(titles('user-bob', 'fix')).not.toEqual(titles('user-carol', 'fix'))
  })

  it('returns nothing for an unknown user', () => {
    expect(searchTasks(state, 'user-nobody', 'checkout')).toEqual([])
  })
})

describe('descriptionSnippet', () => {
  it('centres the window on the match', () => {
    const text = 'a'.repeat(100) + 'needle' + 'b'.repeat(100)
    const snippet = descriptionSnippet(text, 'needle')

    expect(snippet).toContain('needle')
    expect(snippet.length).toBeLessThan(text.length)
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('does not add ellipses when the whole thing fits', () => {
    const snippet = descriptionSnippet('short and sweet', 'sweet')
    expect(snippet).toBe('short and sweet')
  })

  it('falls back to the opening when the query is absent', () => {
    expect(descriptionSnippet('some text here', 'absent')).toBe('some text here')
  })
})
