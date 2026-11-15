// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { queryOptions, useQuery } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { BookOpen, FileText, Loader2, Lock } from 'lucide-react'
import { Main } from '../../components/layout/main'
import { PageHeader } from '../../components/layout/page-header'
import { apiClient } from '../../lib/api-client'
import { usePageTitle } from '../../hooks/use-page-title'

export type DocumentName = 'rules' | 'terms' | 'privacy'

interface DocumentResponse {
  name: string
  body: string
  html: string
}

/**
 * One of the server-level documents, as the page below and a route's loader
 * ask for it, so a loader that starts it beside the route's code hands the
 * page its answer. Fresh across the page mounting; the documents change only
 * when an administrator edits them.
 */
export function documentQuery(name: DocumentName) {
  return queryOptions({
    queryKey: ['document', name],
    queryFn: async () => {
      const response = await apiClient.post<DocumentResponse>(
        '-/document/get',
        { name }
      )
      return response.data.html ?? ''
    },
    staleTime: 30_000,
  })
}

const typography = [
  '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-6',
  '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2',
  '[&_p]:my-3 [&_p]:leading-relaxed',
  '[&_ul]:my-3 [&_ul]:ms-6 [&_ul]:list-disc [&_ul]:space-y-1',
  '[&_ol]:my-3 [&_ol]:ms-6 [&_ol]:list-decimal [&_ol]:space-y-1',
  '[&_li]:leading-relaxed',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:no-underline',
  '[&_strong]:font-semibold',
  '[&_em]:italic',
  '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:ps-4 [&_blockquote]:my-4 [&_blockquote]:text-muted-foreground',
  '[&_hr]:my-8 [&_hr]:border-muted',
].join(' ')

function useDocumentMeta(name: DocumentName): {
  title: string
  icon: typeof BookOpen
} {
  const { t } = useLingui()
  switch (name) {
    case 'rules':
      return { title: t`Server rules`, icon: BookOpen }
    case 'terms':
      return { title: t`Terms and conditions`, icon: FileText }
    case 'privacy':
      return { title: t`Privacy`, icon: Lock }
  }
}

/**
 * Render one of the server-level documents. The host app must declare a
 * `-/document/get` action calling `mochi.document.get(name)` and SPA routes for
 * document/rules, document/terms and document/privacy that mount this.
 */
export function DocumentPage({
  name,
  back,
}: {
  name: DocumentName
  back?: import('../../components/layout/back-button').HeaderBackConfig
}) {
  const { title, icon: Icon } = useDocumentMeta(name)
  usePageTitle(title)
  const { data: html, isError: error } = useQuery(documentQuery(name))

  return (
    <>
      <PageHeader
        title={title}
        icon={<Icon className='size-4 md:size-5' />}
        back={back}
      />
      <Main>
        {error ? (
          <p className='text-destructive'>
            <Trans>Could not load this document. Please try again later.</Trans>
          </p>
        ) : html === undefined ? (
          <div className='flex items-center gap-2 text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            <span>
              <Trans>Loading...</Trans>
            </span>
          </div>
        ) : (
          <div
            className={typography}
            // Server-side rendered + sanitised by mochi.text.markdown (bluemonday).
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </Main>
    </>
  )
}
