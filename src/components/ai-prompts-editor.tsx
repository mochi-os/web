// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The AI prompt customisation editor shared by feeds and forums. Each prompt is
// either the app's default or a custom override; switching back to default
// clears the override server-side.

import { useEffect, useRef, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Check, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { FieldRow } from './layout/section'
import { toast } from '../lib/toast-utils'
import { getErrorMessage } from '../lib/handle-server-error'
import { textUnchanged } from '../lib/change-detection'

/**
 * One editable prompt. `type` is the identifier the backend stores under, and
 * the label and hint travel with it rather than sitting in lookup tables keyed
 * separately: feeds shipped for months with its labels keyed by forums' names
 * (`tag`/`score` against a backend using `new`/`rank`), so two of its three
 * editors rendered with no label at all. One list cannot drift from itself.
 */
export interface AiPromptType {
  type: string
  label: string
  /** Template placeholders the prompt may use, shown under the editor. */
  variables: string
}

/** The app's prompt endpoints. Both apps already expose exactly this pair. */
export interface AiPromptsApi {
  getAiPrompts: (
    entityId: string,
  ) => Promise<{ prompts: Record<string, string>; defaults: Record<string, string> }>
  setAiPrompt: (
    entityId: string,
    type: string,
    prompt: string,
  ) => Promise<unknown>
}

interface PromptEditorProps {
  entityId: string
  api: AiPromptsApi
  prompt: AiPromptType
  customPrompt: string
  defaultPrompt: string
  onSave: (text: string) => void
}

function PromptEditor({
  entityId,
  api,
  prompt,
  customPrompt,
  defaultPrompt,
  onSave,
}: PromptEditorProps) {
  const { t } = useLingui()
  // Destructured, not read as `prompt.variables` at the call below: lingui names
  // a placeholder after the identifier it sees, so a member expression extracts
  // as `Variables: {0}` and orphans the existing `Variables: {variables}`
  // translations in every locale.
  const { label, variables } = prompt
  const isCustom = customPrompt !== ''
  const [custom, setCustom] = useState(isCustom)
  const [text, setText] = useState(customPrompt || defaultPrompt)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleToggle = (val: string) => {
    if (val === 'default' && custom) {
      setSaving(true)
      api
        .setAiPrompt(entityId, prompt.type, '')
        .then(() => {
          setCustom(false)
          setText(defaultPrompt)
          onSave('')
        })
        .catch((error) => {
          toast.error(getErrorMessage(error, t`Failed to reset prompt`))
        })
        .finally(() => setSaving(false))
    } else if (val === 'custom' && !custom) {
      setCustom(true)
      setText(customPrompt || defaultPrompt)
    }
  }

  const handleSave = () => {
    if (textUnchanged(text, customPrompt)) {
      return
    }
    setSaving(true)
    api
      .setAiPrompt(entityId, prompt.type, text)
      .then(() => {
        onSave(text)
        toast.success(t`Prompt saved`)
      })
      .catch((error) => {
        toast.error(getErrorMessage(error, t`Failed to save prompt`))
      })
      .finally(() => setSaving(false))
  }

  return (
    <FieldRow label={label} className='sm:items-start'>
      <div className='w-full space-y-2'>
        <Select
          value={custom ? 'custom' : 'default'}
          onValueChange={handleToggle}
          disabled={saving}
        >
          <SelectTrigger className='w-full max-w-xs'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='default'>
              <Trans>Default</Trans>
            </SelectItem>
            <SelectItem value='custom'>
              <Trans>Custom</Trans>
            </SelectItem>
          </SelectContent>
        </Select>
        {custom && (
          <div className='space-y-2'>
            <textarea
              ref={textareaRef}
              className='border-input bg-background min-h-[240px] w-full resize-y rounded-md border px-3 py-2 font-mono text-sm'
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
            />
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                onClick={handleSave}
                disabled={saving || textUnchanged(text, customPrompt)}
              >
                {saving ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <Check className='size-4' />
                )}
                {saving ? <Trans>Saving...</Trans> : <Trans>Save</Trans>}
              </Button>
              <span className='text-muted-foreground text-xs'>
                <Trans>Variables: {variables}</Trans>
              </span>
            </div>
          </div>
        )}
      </div>
    </FieldRow>
  )
}

export interface AiPromptsEditorProps {
  entityId: string
  /** Prompts to offer, in display order. An empty list renders nothing. */
  types: AiPromptType[]
  api: AiPromptsApi
}

/**
 * Loads the entity's prompt overrides and defaults, then renders one editor per
 * type. Renders nothing until the load settles, and the error if it fails: an
 * editor over empty defaults would show the failure as a blank prompt.
 */
export function AiPromptsEditor({ entityId, types, api }: AiPromptsEditorProps) {
  const { t } = useLingui()
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let active = true
    api
      .getAiPrompts(entityId)
      .then((data) => {
        if (!active) return
        setPrompts(data.prompts || {})
        setDefaults(data.defaults || {})
        setError(null)
        setLoaded(true)
      })
      .catch((error) => {
        if (!active) return
        setError(error)
        setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [entityId, api])

  if (!loaded) return null
  if (error) {
    return (
      <p className='text-destructive text-sm'>
        {getErrorMessage(error, t`Failed to load prompts`)}
      </p>
    )
  }

  return (
    <>
      {types.map((prompt) => (
        <PromptEditor
          key={prompt.type}
          entityId={entityId}
          api={api}
          prompt={prompt}
          customPrompt={prompts[prompt.type] || ''}
          defaultPrompt={defaults[prompt.type] || ''}
          onSave={(text) =>
            setPrompts((prev) => {
              const next = { ...prev }
              if (text) {
                next[prompt.type] = text
              } else {
                delete next[prompt.type]
              }
              return next
            })
          }
        />
      ))}
    </>
  )
}
