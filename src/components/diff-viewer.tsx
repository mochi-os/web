// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from 'react'
import { Trans, Plural, useLingui } from '@lingui/react/macro'
import {
  ChevronDown,
  ChevronRight,
  Columns2,
  FileCode2,
  Minus,
  Plus,
  Rows3,
} from 'lucide-react'
import { useFormat } from '../hooks/use-format'
import { parseDiff, type DiffFile, type DiffLine } from '../lib/diff-parser'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export type DiffViewStyle = 'unified' | 'split'

// One piece of a word-level comparison of two lines.
interface DiffWordChange {
  value: string
  added?: boolean
  removed?: boolean
}

// Compares two lines word by word. The app passes it in, as `diffWords` from
// the `diff` package: the library does not depend on that package, so an app
// that has it gets the changed words marked inside an edited line, and one
// that does not still gets every other part of the view.
// It may answer undefined for two lines it takes to be different lines rather
// than two versions of one, and both are then shown whole.
export type DiffWords = (
  before: string,
  after: string
) => DiffWordChange[] | undefined

const WordsContext = createContext<DiffWords | undefined>(undefined)

const statusBadgeClass =
  'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium leading-none shrink-0'

const statusBadgeStyles: Record<DiffFile['status'], string> = {
  added: `${statusBadgeClass} border-success/30 bg-success/10 text-success dark:border-success/35 dark:bg-success/15`,
  modified: `${statusBadgeClass} border-warning/30 bg-warning/15 text-warning-foreground dark:border-warning/35 dark:bg-warning/20 dark:text-warning`,
  deleted: `${statusBadgeClass} border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/35 dark:bg-destructive/15`,
  renamed: `${statusBadgeClass} border-primary/30 bg-primary/10 text-primary dark:border-primary/35 dark:bg-primary/15 dark:text-primary`,
}

interface DiffViewerProps {
  diff: string
  viewStyle: DiffViewStyle
  /** Marks the changed words inside an edited line. See DiffWords. */
  words?: DiffWords
}

// Pair consecutive remove/add lines for intra-line highlighting
function pairLines(
  lines: DiffLine[]
): { removes: DiffLine[]; adds: DiffLine[]; contexts: DiffLine[] }[] {
  const groups: {
    removes: DiffLine[]
    adds: DiffLine[]
    contexts: DiffLine[]
  }[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.type === 'header') {
      i++
      continue
    }
    if (line.type === 'context') {
      groups.push({ removes: [], adds: [], contexts: [line] })
      i++
    } else if (line.type === 'remove') {
      const removes: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'remove') {
        removes.push(lines[i])
        i++
      }
      const adds: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'add') {
        adds.push(lines[i])
        i++
      }
      groups.push({ removes, adds, contexts: [] })
    } else if (line.type === 'add') {
      const adds: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'add') {
        adds.push(lines[i])
        i++
      }
      groups.push({ removes: [], adds, contexts: [] })
    } else {
      i++
    }
  }

  return groups
}

// Render a line with intra-line word highlighting
function IntraLineHighlight({
  oldContent,
  newContent,
  side,
}: {
  oldContent: string
  newContent: string
  side: 'old' | 'new'
}) {
  const words = useContext(WordsContext)
  const whole = side === 'old' ? oldContent : newContent
  if (!words) return <span>{whole}</span>
  const changes = words(oldContent, newContent)
  if (!changes) return <span>{whole}</span>

  return (
    <span>
      {changes.map((change, i) => {
        if (change.added) {
          if (side === 'new') {
            return (
              <span key={i} className='bg-success/25 dark:bg-success/40'>
                {change.value}
              </span>
            )
          }
          return null
        }
        if (change.removed) {
          if (side === 'old') {
            return (
              <span
                key={i}
                className='bg-destructive/20 dark:bg-destructive/40'
              >
                {change.value}
              </span>
            )
          }
          return null
        }
        return <span key={i}>{change.value}</span>
      })}
    </span>
  )
}

// File header with collapsible toggle
function FileHeader({
  file,
  collapsed,
  onToggle,
}: {
  file: DiffFile
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type='button'
      onClick={onToggle}
      className='bg-muted/50 hover:bg-hover/80 sticky top-0 z-10 flex w-full items-center gap-2 border-b px-3 py-2 font-mono text-sm transition-colors'
    >
      {collapsed ? (
        <ChevronRight className='size-3.5 shrink-0 rtl:rotate-180' />
      ) : (
        <ChevronDown className='size-3.5 shrink-0' />
      )}
      <span
        className={cn(
          'font-sans text-[10px]',
          statusBadgeStyles[file.status] ||
            'border-border bg-muted text-foreground'
        )}
      >
        {file.status.charAt(0).toUpperCase()}
      </span>
      <span className='flex-1 truncate text-start'>{file.path}</span>
      {file.oldPath && (
        <span className='text-muted-foreground shrink-0 font-sans text-xs'>
          <Trans>(from {file.oldPath})</Trans>
        </span>
      )}
      <span className='flex shrink-0 items-center gap-2 font-sans text-xs'>
        {file.additions > 0 && (
          <span className={cn('flex items-center gap-0.5', 'text-success')}>
            <Plus className='size-3' />
            {file.additions}
          </span>
        )}
        {file.deletions > 0 && (
          <span className={cn('flex items-center gap-0.5', 'text-destructive')}>
            <Minus className='size-3' />
            {file.deletions}
          </span>
        )}
      </span>
    </button>
  )
}

// Unified diff view
function UnifiedView({
  file,
  hunkHeaders = true,
  textSize = 'xs',
}: {
  file: DiffFile
  hunkHeaders?: boolean
  textSize?: 'xs' | 'sm'
}) {
  return (
    <table
      className={cn(
        'w-full border-collapse font-mono',
        textSize === 'sm' ? 'text-sm' : 'text-xs'
      )}
    >
      {/* Each hunk is its own tbody; a wrapping tbody would nest them. */}
      {file.hunks.map((hunk, hi) => {
        const groups = pairLines(hunk.lines)
        return (
          <tbody key={hi}>
            {hunkHeaders && (
              <tr className='bg-primary/5 dark:bg-primary/10'>
                <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
                  ...
                </td>
                <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
                  ...
                </td>
                <td className='text-primary px-3 py-0.5'>{hunk.header}</td>
              </tr>
            )}
            {groups.map((group, gi) => (
              <UnifiedGroup key={gi} group={group} />
            ))}
          </tbody>
        )
      })}
    </table>
  )
}

function UnifiedGroup({
  group,
}: {
  group: { removes: DiffLine[]; adds: DiffLine[]; contexts: DiffLine[] }
}) {
  if (group.contexts.length > 0) {
    return (
      <>
        {group.contexts.map((line, i) => (
          <tr key={`c${i}`}>
            <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
              {line.oldNum}
            </td>
            <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
              {line.newNum}
            </td>
            <td className='px-3 py-0.5 break-all whitespace-pre-wrap'>
              {' '}
              {line.content}
            </td>
          </tr>
        ))}
      </>
    )
  }

  const paired = Math.min(group.removes.length, group.adds.length)

  return (
    <>
      {group.removes.map((line, i) => (
        <tr key={`r${i}`} className='bg-destructive/10 dark:bg-destructive/15'>
          <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
            {line.oldNum}
          </td>
          <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none' />
          <td className='px-3 py-0.5 break-all whitespace-pre-wrap'>
            <span className='text-destructive select-none'>-</span>
            {i < paired ? (
              <IntraLineHighlight
                oldContent={line.content}
                newContent={group.adds[i].content}
                side='old'
              />
            ) : (
              line.content
            )}
          </td>
        </tr>
      ))}
      {group.adds.map((line, i) => (
        <tr key={`a${i}`} className='bg-success/10 dark:bg-success/15'>
          <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none' />
          <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
            {line.newNum}
          </td>
          <td className='px-3 py-0.5 break-all whitespace-pre-wrap'>
            <span className='text-success select-none'>+</span>
            {i < paired ? (
              <IntraLineHighlight
                oldContent={group.removes[i].content}
                newContent={line.content}
                side='new'
              />
            ) : (
              line.content
            )}
          </td>
        </tr>
      ))}
    </>
  )
}

// Split diff view
function SplitView({
  file,
  hunkHeaders = true,
  textSize = 'xs',
}: {
  file: DiffFile
  hunkHeaders?: boolean
  textSize?: 'xs' | 'sm'
}) {
  return (
    <table
      className={cn(
        'w-full border-collapse font-mono',
        textSize === 'sm' ? 'text-sm' : 'text-xs'
      )}
    >
      {/* Each hunk is its own tbody; a wrapping tbody would nest them. */}
      {file.hunks.map((hunk, hi) => {
        const groups = pairLines(hunk.lines)
        return (
          <tbody key={hi}>
            {hunkHeaders && (
              <tr className='bg-primary/5 dark:bg-primary/10'>
                <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
                  ...
                </td>
                <td className='text-primary w-1/2 border-e px-3 py-0.5'>
                  {hunk.header}
                </td>
                <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
                  ...
                </td>
                <td className='text-primary w-1/2 px-3 py-0.5'>
                  {hunk.header}
                </td>
              </tr>
            )}
            {groups.map((group, gi) => (
              <SplitGroup key={gi} group={group} />
            ))}
          </tbody>
        )
      })}
    </table>
  )
}

function SplitGroup({
  group,
}: {
  group: { removes: DiffLine[]; adds: DiffLine[]; contexts: DiffLine[] }
}) {
  if (group.contexts.length > 0) {
    return (
      <>
        {group.contexts.map((line, i) => (
          <tr key={`c${i}`}>
            <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
              {line.oldNum}
            </td>
            <td className='w-1/2 border-e px-3 py-0.5 break-all whitespace-pre-wrap'>
              {line.content}
            </td>
            <td className='text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none'>
              {line.newNum}
            </td>
            <td className='w-1/2 px-3 py-0.5 break-all whitespace-pre-wrap'>
              {line.content}
            </td>
          </tr>
        ))}
      </>
    )
  }

  const maxLen = Math.max(group.removes.length, group.adds.length)
  const rows: ReactNode[] = []

  for (let i = 0; i < maxLen; i++) {
    const rem = group.removes[i]
    const add = group.adds[i]
    const hasPair = rem && add

    rows.push(
      <tr key={`s${i}`}>
        <td
          className={cn(
            'text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none',
            rem && 'bg-destructive/10 dark:bg-destructive/15'
          )}
        >
          {rem?.oldNum}
        </td>
        <td
          className={cn(
            'w-1/2 border-e px-3 py-0.5 break-all whitespace-pre-wrap',
            rem && 'bg-destructive/10 dark:bg-destructive/15'
          )}
        >
          {rem && (
            <>
              {hasPair ? (
                <IntraLineHighlight
                  oldContent={rem.content}
                  newContent={add.content}
                  side='old'
                />
              ) : (
                rem.content
              )}
            </>
          )}
        </td>
        <td
          className={cn(
            'text-muted-foreground w-[1px] border-e px-2 py-0.5 text-end whitespace-nowrap select-none',
            add && 'bg-success/10 dark:bg-success/15'
          )}
        >
          {add?.newNum}
        </td>
        <td
          className={cn(
            'w-1/2 px-3 py-0.5 break-all whitespace-pre-wrap',
            add && 'bg-success/10 dark:bg-success/15'
          )}
        >
          {add && (
            <>
              {hasPair ? (
                <IntraLineHighlight
                  oldContent={rem.content}
                  newContent={add.content}
                  side='new'
                />
              ) : (
                add.content
              )}
            </>
          )}
        </td>
      </tr>
    )
  }

  return <>{rows}</>
}

// The lines of one comparison, with no file header and no totals: for a page
// that compares two versions of one text rather than a set of files. A
// comparison built with the whole text as context is a single hunk, whose
// header says nothing, so the caller can leave it out.
export function DiffFileView({
  file,
  viewStyle,
  words,
  hunkHeaders,
  prose,
  textSize = 'xs',
}: {
  file: DiffFile
  viewStyle: DiffViewStyle
  words?: DiffWords
  hunkHeaders?: boolean
  /**
   * The text is written language, not code. A code line breaks anywhere, so a
   * long token cannot push the table wide; prose breaks between words, and
   * inside one only when the word alone is wider than the column.
   */
  prose?: boolean
  /** Keeps written text comfortable to read when the default is too small. */
  textSize?: 'xs' | 'sm'
}) {
  return (
    <WordsContext.Provider value={words}>
      <div
        className={cn(
          'overflow-x-auto rounded-lg border',
          prose && '[&_td]:[overflow-wrap:anywhere] [&_td]:[word-break:normal]'
        )}
      >
        {viewStyle === 'split' ? (
          <SplitView
            file={file}
            hunkHeaders={hunkHeaders}
            textSize={textSize}
          />
        ) : (
          <UnifiedView
            file={file}
            hunkHeaders={hunkHeaders}
            textSize={textSize}
          />
        )}
      </div>
    </WordsContext.Provider>
  )
}

// The switch between one column and two. Every page that shows a diff offers
// the same pair, so the control lives with the view it drives. The buttons are
// icons alone, named by their tooltip and to a screen reader.
export function DiffViewToggle({
  value,
  onChange,
}: {
  value: DiffViewStyle
  onChange: (value: DiffViewStyle) => void
}) {
  const { t } = useLingui()
  const options = [
    { style: 'unified', label: t`Unified`, Icon: Rows3 },
    { style: 'split', label: t`Split`, Icon: Columns2 },
  ] as const
  return (
    <div className='flex overflow-hidden rounded-md border'>
      {options.map(({ style, label, Icon }, index) => (
        <Tooltip key={style}>
          <TooltipTrigger asChild>
            <button
              type='button'
              aria-label={label}
              aria-pressed={value === style}
              onClick={() => value !== style && onChange(style)}
              className={cn(
                'flex size-8 items-center justify-center transition-colors',
                index > 0 && 'border-s',
                value === style
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-hover'
              )}
            >
              <Icon className='size-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export function DiffViewer({ diff, viewStyle, words }: DiffViewerProps) {
  const { files, truncated } = useMemo(() => parseDiff(diff), [diff])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const { formatFileSize } = useFormat()

  if (files.length === 0 && truncated === 0) {
    return (
      <div className='text-muted-foreground p-8 text-center text-sm'>
        <Trans>No changes to display</Trans>
      </div>
    )
  }

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)

  const toggleFile = (path: string) => {
    setCollapsed((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  return (
    <WordsContext.Provider value={words}>
      <div className='space-y-4'>
        <div className='flex items-center gap-4 px-1 text-sm'>
          <span className='text-muted-foreground flex items-center gap-1.5'>
            <FileCode2 className='size-4' />
            <Plural
              value={files.length}
              one='# file changed'
              other='# files changed'
            />
          </span>
          <span className={cn('flex items-center gap-1', 'text-success')}>
            <Plus className='size-3' />
            {totalAdditions}
          </span>
          <span className={cn('flex items-center gap-1', 'text-destructive')}>
            <Minus className='size-3' />
            {totalDeletions}
          </span>
        </div>

        {files.map((file) => (
          <div key={file.path} className='overflow-hidden rounded-lg border'>
            <FileHeader
              file={file}
              collapsed={!!collapsed[file.path]}
              onToggle={() => toggleFile(file.path)}
            />
            {!collapsed[file.path] && (
              <div className='overflow-x-auto'>
                {file.isBinary ? (
                  // Binary files carry no hunks — say so rather than render an
                  // empty body, which reads as "nothing changed".
                  <p className='text-muted-foreground px-3 py-4 text-sm'>
                    <Trans>Binary file not shown</Trans>
                  </p>
                ) : file.skipped ? (
                  // Core did not compare the file: it is over the ceiling it
                  // names, so there is nothing to render but the reason.
                  <p className='text-muted-foreground px-3 py-4 text-sm'>
                    {file.limit ? (
                      <Trans>
                        Not compared: larger than {formatFileSize(file.limit)}
                      </Trans>
                    ) : (
                      <Trans>Not compared: over the size limit</Trans>
                    )}
                  </p>
                ) : viewStyle === 'split' ? (
                  <SplitView file={file} />
                ) : (
                  <UnifiedView file={file} />
                )}
              </div>
            )}
          </div>
        ))}
        {truncated > 0 && (
          <p className='text-muted-foreground px-1 text-sm'>
            <Plural
              value={truncated}
              one='# more file not shown'
              other='# more files not shown'
            />
          </p>
        )}
      </div>
    </WordsContext.Provider>
  )
}
