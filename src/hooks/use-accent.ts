import { useQuery } from '@tanstack/react-query'
import { requestHelpers } from '../lib/request'

export type Style = { accent?: string }

// Fetches /<fingerprint>/-/style and returns the parsed style object.
// Returns {} when the fingerprint is missing, the request fails, or the
// entity hasn't set a style. Callers apply the accent however they like
// (inline style, CSS variable, etc.); the hook just supplies the value.
export function useAccent(fingerprint?: string | null): Style {
  const { data } = useQuery<Style>({
    queryKey: ['accent', fingerprint],
    queryFn: async () => {
      if (!fingerprint) return {}
      try {
        return await requestHelpers.get<Style>(`/${fingerprint}/-/style`)
      } catch {
        return {}
      }
    },
    enabled: !!fingerprint,
    staleTime: 5 * 60 * 1000,
  })
  return data ?? {}
}
