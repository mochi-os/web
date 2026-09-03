// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
import { useState, useMemo } from 'react'
import { Trans } from '@lingui/react/macro'
import { z } from 'zod'
import { useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Loader2, type LucideIcon } from 'lucide-react'
import { Button } from './button'
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from './responsive-dialog'
import { Input } from './input'
import { Textarea } from './textarea'
import { Switch } from './switch'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form'

// Characters the server refuses in an entity name (`^[^<>\r\n]{1,1000}$`).
// Every app's settings page checks the same set.
export const DISALLOWED_NAME_CHARS = /[<>\r\n]/

export interface CreateEntityToggle {
  name: string
  label: string
  defaultValue?: boolean
}

export interface CreateEntityDialogProps {
  // Dialog control
  open?: boolean
  onOpenChange?: (open: boolean) => void
  // Trigger button
  triggerIcon?: LucideIcon
  triggerLabel?: string
  hideTrigger?: boolean
  // Dialog content
  icon?: LucideIcon
  title: string
  /** The noun as it reads mid-sentence ("wiki"); it is never re-cased here. */
  entityLabel: string
  // Optional fields
  showDescription?: boolean
  descriptionLabel?: string
  showPrivacyToggle?: boolean
  privacyLabel?: string
  extraToggles?: CreateEntityToggle[]
  // Submission
  onSubmit: (values: CreateEntityValues) => void | Promise<void>
  isPending?: boolean
  submitLabel?: string
}

export interface CreateEntityValues {
  name: string
  description?: string
  privacy?: 'public' | 'private'
  toggles?: Record<string, boolean>
}

export function CreateEntityDialog({
  open,
  onOpenChange,
  triggerIcon: TriggerIcon,
  triggerLabel,
  hideTrigger,
  icon: Icon,
  title,
  entityLabel,
  showDescription,
  descriptionLabel = t`Description`,
  showPrivacyToggle,
  privacyLabel = t`Allow anyone to search for ${entityLabel}`,
  extraToggles = [],
  onSubmit,
  isPending = false,
  submitLabel,
}: CreateEntityDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen

  // Build schema dynamically (memoized to prevent re-validation on every render)
  const schema = useMemo(() => z.object({
    name: z
      .string()
      .min(1, t`Name is required`)
      .max(1000, t`Name must be 1000 characters or less`)
      .refine((val: string) => !DISALLOWED_NAME_CHARS.test(val), {
        message: t`Name cannot contain < or > characters`,
      }),
    description: z.string().optional(),
    allowSearch: z.boolean(),
    ...Object.fromEntries(
      extraToggles.map((toggle) => [toggle.name, z.boolean()])
    ),
  }), [extraToggles])

  type FormValues = z.infer<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      allowSearch: true,
      ...Object.fromEntries(
        extraToggles.map((toggle) => [toggle.name, toggle.defaultValue ?? true])
      ),
    },
  })

  const handleSubmit = async (values: FormValues) => {
    const { name, description, allowSearch, ...rest } = values
    await onSubmit({
      name: name.trim(),
      description: showDescription ? description?.trim() : undefined,
      privacy: showPrivacyToggle ? (allowSearch ? 'public' : 'private') : undefined,
      toggles: extraToggles.length > 0 ? rest as Record<string, boolean> : undefined,
    })
    form.reset()
    setIsOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      form.reset()
    }
  }

  const defaultSubmitLabel = t`Create ${entityLabel}`

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      shouldCloseOnInteractOutside={false}
    >
      {!hideTrigger && (
        <ResponsiveDialogTrigger asChild>
          <Button size="sm" className="text-sm">
            {TriggerIcon ? <TriggerIcon className="size-4" /> : <Plus className="size-4" />}
            {triggerLabel ?? defaultSubmitLabel}
          </Button>
        </ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent className="sm:max-w-[520px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            {Icon && <Icon className="size-5" />}
            {title}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel><Trans>{entityLabel} name</Trans></FormLabel>
                  <FormControl>
                    <Input disabled={isPending} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showDescription && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{descriptionLabel}</FormLabel>
                    <FormControl>
                      <Textarea disabled={isPending} rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(showPrivacyToggle || extraToggles.length > 0) && (
              <div className="space-y-3">
                {showPrivacyToggle && (
                  <FormField
                    control={form.control}
                    name="allowSearch"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <FormLabel className="text-sm font-medium">
                          {privacyLabel}
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {extraToggles.map((toggle) => (
                  <FormField
                    key={toggle.name}
                    control={form.control}
                    name={toggle.name as FieldPath<FormValues>}
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <FormLabel className="text-sm font-medium">
                          {toggle.label}
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value === true}
                            onCheckedChange={field.onChange}
                            disabled={isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}

            <ResponsiveDialogFooter className="gap-2">
              <ResponsiveDialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  <Trans>Cancel</Trans>
                </Button>
              </ResponsiveDialogClose>
              <Button type="submit" disabled={!form.formState.isValid || isPending}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {isPending ? t`Creating...` : (submitLabel ?? defaultSubmitLabel)}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
