import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { getAuthLoginUrl } from '../lib/app-path'

export function useRequireAuth() {
  const { isAuthenticated, isInitialized, isLoading } = useAuth()

  useEffect(() => {
    if (isInitialized && !isAuthenticated && !isLoading) {
      const loginUrl = getAuthLoginUrl()
      window.location.href = loginUrl
    }
  }, [isAuthenticated, isInitialized, isLoading])

  return {
    isLoading: !isInitialized || isLoading,
    isAuthenticated,
  }
}
