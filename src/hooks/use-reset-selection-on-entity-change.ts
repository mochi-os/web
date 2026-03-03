import { useEffect, useRef } from 'react'

export function useResetSelectionOnEntityChange(
  entityId: string,
  resetSelection: (nextSelection: string | null) => void
) {
  const previousEntityIdRef = useRef(entityId)

  useEffect(() => {
    if (previousEntityIdRef.current !== entityId) {
      resetSelection(null)
    }
    previousEntityIdRef.current = entityId
  }, [entityId, resetSelection])
}
