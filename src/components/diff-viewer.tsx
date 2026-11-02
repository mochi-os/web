// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  useEffect,
  useId,
  useState,
  useMemo,
  type ComponentType,
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
import { lineWords } from '../lib/diff-text'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export type DiffViewStyle = 'unified' | 'split'

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
  /** Controls placed in each file's header, after its counts. */
  actions?: ComponentType<{ file: DiffFile }>
  /**
   * Draws a file's lines in place of the default, for an app that compares a
   * file again with other options. DiffLines draws them the default way.
   */
  body?: ComponentType<{ file: DiffFile; viewStyle: DiffViewStyle }>
}

// A file changing more lines than this, or listed after this many files, is
// held back behind a button: a long diff drawn whole makes the page slow to
// open and to scroll, and is rarely read line by line.
const LARGE_LINES = 400
const SHOWN_FILES = 50

// Lines drawn when a diff first shows, and in each later step while the
// browser is idle: a large diff shows its first files at once, and the page
// stays responsive while the rest fill in.
const FIRST_LINES = 1500
const STEP_LINES = 2000

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

// Render a line with intra-line word highlighting. Two lines with too little
// in common are different lines rather than two versions of one, and are
// shown whole.
function IntraLineHighlight({
  oldContent,
  newContent,
  side,
}: {
  oldContent: string
  newContent: string
  side: 'old' | 'new'
}) {
  const whole = side === 'old' ? oldContent : newContent
  const changes = lineWords(oldContent, newContent)
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

// The badge naming how a file changed: A, M, D or R.
function StatusBadge({ status }: { status: DiffFile['status'] }) {
  return (
    <span
      className={cn(
        'font-sans text-[10px]',
        statusBadgeStyles[status] || 'border-border bg-muted text-foreground'
      )}
    >
      {status.charAt(0).toUpperCase()}
    </span>
  )
}

// A file's added and removed line counts, each left out when zero.
function LineCounts({ file }: { file: DiffFile }) {
  return (
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
  )
}

// File header: the toggle that collapses the file, and the app's controls
// beside it rather than inside it, since a button cannot hold another.
function FileHeader({
  file,
  collapsed,
  onToggle,
  actions: Actions,
}: {
  file: DiffFile
  collapsed: boolean
  onToggle: () => void
  actions?: ComponentType<{ file: DiffFile }>
}) {
  return (
    <div className='bg-muted/50 sticky top-0 z-10 flex items-center border-b'>
      <button
        type='button'
        onClick={onToggle}
        aria-expanded={!collapsed}
        className='hover:bg-hover/80 flex min-w-0 flex-1 items-center gap-2 px-3 py-2 font-mono text-sm transition-colors'
      >
        {collapsed ? (
          <ChevronRight className='size-3.5 shrink-0 rtl:rotate-180' />
        ) : (
          <ChevronDown className='size-3.5 shrink-0' />
        )}
        <StatusBadge status={file.status} />
        <span className='flex-1 truncate text-start'>{file.path}</span>
        {file.oldPath && (
          <span className='text-muted-foreground shrink-0 font-sans text-xs'>
            <Trans>(from {file.oldPath})</Trans>
          </span>
        )}
        <LineCounts file={file} />
      </button>
      {Actions && (
        <div className='flex shrink-0 items-center gap-1 pe-2'>
          <Actions file={file} />
        </div>
      )}
    </div>
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
  hunkHeaders,
  prose,
  textSize = 'xs',
}: {
  file: DiffFile
  viewStyle: DiffViewStyle
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
    <div
      className={cn(
        'overflow-x-auto rounded-lg border',
        prose && '[&_td]:[overflow-wrap:anywhere] [&_td]:[word-break:normal]'
      )}
    >
      {viewStyle === 'split' ? (
        <SplitView file={file} hunkHeaders={hunkHeaders} textSize={textSize} />
      ) : (
        <UnifiedView
          file={file}
          hunkHeaders={hunkHeaders}
          textSize={textSize}
        />
      )}
    </div>
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

// One file's lines as DiffViewer draws them, or the reason there are none: a
// binary file, or one core did not compare. For an app's own `body`, which
// draws a file compared again and falls back to this.
export function DiffLines({
  file,
  viewStyle,
}: {
  file: DiffFile
  viewStyle: DiffViewStyle
}) {
  const { formatFileSize } = useFormat()
  return (
    <div className='overflow-x-auto'>
      {file.isBinary ? (
        // Binary files carry no hunks — say so rather than render an empty
        // body, which reads as "nothing changed".
        <p className='text-muted-foreground px-3 py-4 text-sm'>
          <Trans>Binary file not shown</Trans>
        </p>
      ) : file.skipped ? (
        // Core did not compare the file: it is over the ceiling it names, so
        // there is nothing to render but the reason.
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
  )
}

// Pixels a card's header takes, and each line of a file drawn in full.
const HEADER_HEIGHT = 41
const LINE_HEIGHT = 20

// The rows a file's lines take, a hunk's header among them.
function fileLines(file: DiffFile) {
  return file.hunks.reduce((sum, hunk) => sum + hunk.lines.length + 1, 0)
}

// A file's lines as plain text, the marks of a patch before each: what its card
// holds until its turn to be drawn comes. One text node costs little beside the
// rows the drawn view builds, yet find in page, select all, copying, printing
// and screen readers meet every line from the start.
const MARKS: Record<DiffLine['type'], string> = {
  header: '',
  add: '+',
  remove: '-',
  context: ' ',
}

function plainLines(file: DiffFile) {
  return file.hunks
    .flatMap((hunk) =>
      hunk.lines.map((line) => MARKS[line.type] + line.content)
    )
    .join('\n')
}

// Whether a file waits behind Load diff until the reader asks for it.
function heldBack(file: DiffFile, index: number) {
  return index >= SHOWN_FILES || file.additions + file.deletions > LARGE_LINES
}

// A guess at a file card's height before it is drawn: its header, and its
// lines unless it is collapsed or waiting behind Load diff.
function cardHeight(file: DiffFile, collapsed: boolean, held: boolean) {
  if (collapsed) return HEADER_HEIGHT
  if (held || file.isBinary || file.skipped) return HEADER_HEIGHT + 56
  return HEADER_HEIGHT + fileLines(file) * LINE_HEIGHT
}

// Where a drawing step that starts at file `from` ends: after the files whose
// lines fill `lines`, and always at least one further. A held-back file draws
// only its button, so it costs nothing.
function stepEnd(files: DiffFile[], from: number, lines: number) {
  let end = from
  let total = 0
  while (end < files.length && (end === from || total < lines)) {
    if (!heldBack(files[end], end)) total += fileLines(files[end])
    end++
  }
  return end
}

export function DiffViewer({
  diff,
  viewStyle,
  actions,
  body: Body = DiffLines,
}: DiffViewerProps) {
  const { files, truncated } = useMemo(() => parseDiff(diff), [diff])
  // Keyed by position: a diff names each path once, but position is what the
  // list and the cards share.
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})
  const [listed, setListed] = useState(false)
  const id = useId()
  // How many files from the start are drawn; the rest show their headers.
  // A new diff starts again from its first files.
  const [drawn, setDrawn] = useState(() => ({
    files,
    count: stepEnd(files, 0, FIRST_LINES),
  }))
  if (drawn.files !== files) {
    setDrawn({ files, count: stepEnd(files, 0, FIRST_LINES) })
  }
  useEffect(() => {
    if (drawn.files !== files || drawn.count >= files.length) return
    const step = () =>
      setDrawn((previous) =>
        previous.files === files
          ? { files, count: stepEnd(files, previous.count, STEP_LINES) }
          : previous
      )
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(step, { timeout: 200 })
      return () => window.cancelIdleCallback(handle)
    }
    const handle = window.setTimeout(step, 0)
    return () => window.clearTimeout(handle)
  }, [drawn, files])

  if (files.length === 0 && truncated === 0) {
    return (
      <div className='text-muted-foreground p-8 text-center text-sm'>
        <Trans>No changes to display</Trans>
      </div>
    )
  }

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)
  const anyOpen = files.some((_, index) => !collapsed[index])
  const held = (file: DiffFile, index: number) =>
    !loaded[index] && heldBack(file, index)

  const toggleFile = (index: number) => {
    setCollapsed((prev) => ({ ...prev, [index]: !prev[index] }))
  }
  const toggleAll = () => {
    setCollapsed(
      anyOpen ? Object.fromEntries(files.map((_, index) => [index, true])) : {}
    )
  }
  // Open the file, draw it even if it was held back, and bring it into view.
  const jump = (index: number) => {
    setCollapsed((prev) => ({ ...prev, [index]: false }))
    setLoaded((prev) => ({ ...prev, [index]: true }))
    requestAnimationFrame(() =>
      document
        .getElementById(`${id}-${index}`)
        ?.scrollIntoView({ block: 'start' })
    )
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <div className='flex flex-wrap items-center gap-4 px-1 text-sm'>
          <button
            type='button'
            onClick={() => setListed(!listed)}
            aria-expanded={listed}
            className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors'
          >
            {listed ? (
              <ChevronDown className='size-3.5' />
            ) : (
              <ChevronRight className='size-3.5 rtl:rotate-180' />
            )}
            <FileCode2 className='size-4' />
            <Plural
              value={files.length}
              one='# file changed'
              other='# files changed'
            />
          </button>
          <span className={cn('flex items-center gap-1', 'text-success')}>
            <Plus className='size-3' />
            {totalAdditions}
          </span>
          <span className={cn('flex items-center gap-1', 'text-destructive')}>
            <Minus className='size-3' />
            {totalDeletions}
          </span>
          {files.length > 1 && (
            <button
              type='button'
              onClick={toggleAll}
              className='text-muted-foreground hover:text-foreground ms-auto text-xs transition-colors'
            >
              {anyOpen ? (
                <Trans>Collapse all</Trans>
              ) : (
                <Trans>Expand all</Trans>
              )}
            </button>
          )}
        </div>
        {listed && (
          <ul className='divide-y overflow-hidden rounded-lg border'>
            {files.map((file, index) => (
              <li key={index}>
                <button
                  type='button'
                  onClick={() => jump(index)}
                  className='hover:bg-hover flex w-full items-center gap-2 px-3 py-1.5 font-mono text-xs transition-colors'
                >
                  <StatusBadge status={file.status} />
                  <span className='flex-1 truncate text-start'>
                    {file.path}
                  </span>
                  <LineCounts file={file} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {files.map((file, index) => (
        // A card off screen is not laid out or painted until it nears the
        // view, which on a large diff is most of the page's work. Until then
        // its height is guessed from its lines so the scrollbar holds still,
        // and once drawn the browser keeps the real one. Find in page still
        // searches it, as it does a card waiting for its turn to be drawn,
        // which holds its lines as plain text.
        <div
          key={index}
          id={`${id}-${index}`}
          className='scroll-mt-24 overflow-hidden rounded-lg border [content-visibility:auto]'
          style={{
            containIntrinsicSize: `auto ${cardHeight(
              file,
              !!collapsed[index],
              held(file, index)
            )}px`,
          }}
        >
          <FileHeader
            file={file}
            collapsed={!!collapsed[index]}
            onToggle={() => toggleFile(index)}
            actions={actions}
          />
          {!collapsed[index] &&
            (held(file, index) ? (
              <div className='flex justify-center px-3 py-4'>
                <button
                  type='button'
                  onClick={() =>
                    setLoaded((prev) => ({ ...prev, [index]: true }))
                  }
                  className='text-primary text-sm hover:underline'
                >
                  <Trans>Load diff</Trans>
                </button>
              </div>
            ) : index >= drawn.count && !loaded[index] ? (
              <pre
                className='text-muted-foreground overflow-hidden px-3 font-mono text-xs'
                style={{
                  height: cardHeight(file, false, false) - HEADER_HEIGHT,
                  lineHeight: `${LINE_HEIGHT}px`,
                }}
              >
                {plainLines(file)}
              </pre>
            ) : (
              <Body file={file} viewStyle={viewStyle} />
            ))}
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
  )
}
