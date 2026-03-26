function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function coerceObjectArray<T extends object>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (!isObjectRecord(value)) {
    return []
  }

  const values = Object.values(value)
  return values.every(
    (item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  )
    ? (values as T[])
    : []
}
