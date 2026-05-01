import { useState, useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import { SlidersHorizontal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Skeleton } from './ui/skeleton'
import { cn } from '../lib/utils'
import { useAuthStore } from '../stores/auth-store'
import { toast } from '../lib/toast-utils'
import { getErrorMessage } from '../lib/handle-server-error'

const MENU_PATH = '/menu'

interface Category {
  id: number
  label: string
  default: number
}

interface TopicRow {
  id: number
  app: string
  topic: string
  object: string
  label: string
  category: number | null
}

async function menuFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token || ''
  const res = await fetch(`${MENU_PATH}/${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`Menu API error: ${res.status}`)
  return res.json()
}

interface Props {
  app: string
  topic?: string
  object?: string
  className?: string
}

export function NotificationCategoryButton({ app, topic = '', object = '', className }: Props) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [row, setRow] = useState<TopicRow | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const params = new URLSearchParams({ app, topic, object })
        const [catsRes, rowRes] = await Promise.all([
          menuFetch<{ data: Category[] }>('-/notifications/categories'),
          menuFetch<{ data: TopicRow | null }>(`-/notifications/topic/lookup?${params.toString()}`),
        ])
        if (cancelled) return
        const cats = [...(catsRes.data || [])].sort((a, b) => {
          if (a.id === 0) return 1
          if (b.id === 0) return -1
          return a.label.localeCompare(b.label)
        })
        setCategories(cats)
        setRow(rowRes.data || null)
      } catch {
        if (!cancelled) {
          setCategories([])
          setRow(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, app, topic, object])

  const onChange = async (value: string) => {
    if (!row) return
    setSaving(true)
    try {
      const params = new URLSearchParams({ id: String(row.id), category: value })
      await menuFetch('-/notifications/topic/set_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      setRow({ ...row, category: parseInt(value, 10) })
      const cat = categories?.find((c) => String(c.id) === value)
      const label = row.label || row.topic
      toast.success(cat ? `${label}: ${cat.label}` : `${label} updated`)
      setTimeout(() => setOpen(false), 0)
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update category"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={"Change notification category"}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-interactive-hover hover:text-foreground active:bg-interactive-active',
            className
          )}
        >
          <SlidersHorizontal className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground"><Trans>Category for this notification</Trans></p>
          {!categories ? (
            <Skeleton className="h-9 w-full" />
          ) : !row ? (
            <p className="text-xs text-muted-foreground"><Trans>No topic record yet — try again after the next notification.</Trans></p>
          ) : (
            <Select
              value={row.category != null ? String(row.category) : ''}
              onValueChange={onChange}
              disabled={saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={"Unassigned"} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
