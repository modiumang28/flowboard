import { useSearchParams } from 'react-router-dom'

export type ViewMode = 'board' | 'list'

/** The chosen view lives in the URL, so it survives a refresh and is shareable. */
export function useViewMode(): ViewMode {
  const [params] = useSearchParams()
  return params.get('view') === 'list' ? 'list' : 'board'
}
