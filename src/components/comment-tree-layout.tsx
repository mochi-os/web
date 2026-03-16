import type { ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'

// Grid config - these match the proven Feeds design
const COL_WIDTH = 'w-5' // 20px
const AVATAR_SIZE = 'size-5' // 20px

export interface CommentTreeLayoutProps {
  /** Nesting depth (0 = top-level) */
  depth?: number
  /** Whether the node is collapsed */
  isCollapsed: boolean
  /** Toggle collapse state */
  onToggleCollapse: () => void
  /** Whether the node has children */
  hasChildren: boolean
  /** The avatar element to display */
  avatar: ReactNode
  /** The main content (author, body, actions, etc.) */
  content: ReactNode
  /** The nested child nodes (only rendered when not collapsed) */
  children?: ReactNode
  /** Collapsed summary content (shown when collapsed) */
  collapsedContent?: ReactNode
}

export function CommentTreeLayout({
  depth = 0,
  isCollapsed,
  onToggleCollapse,
  hasChildren,
  avatar,
  content,
  children,
  collapsedContent,
}: CommentTreeLayoutProps) {
  // Rainbow palette
  const RAINBOW_COLORS = [
    'bg-rose-400',
    'bg-amber-400',
    'bg-emerald-400',
    'bg-sky-400',
    'bg-violet-400',
  ]

  const RAINBOW_BORDERS = [
    'border-rose-400',
    'border-amber-400',
    'border-emerald-400',
    'border-sky-400',
    'border-violet-400',
  ]

  // Color for the line of THIS level
  const selfColorBg = RAINBOW_COLORS[depth % RAINBOW_COLORS.length]
  const selfColorBorder = RAINBOW_BORDERS[depth % RAINBOW_BORDERS.length]

  return (
    <div className='flex flex-row items-stretch'>
      {/* 1. Sidebar Column: Line + Connector + Button */}
      <div className={`relative ${COL_WIDTH} shrink-0`}>
        {/* Continuous Vertical Line (Full Height) */}
        {/* It stretches automatically because of flex items-stretch */}
        {/* Added z-0 to ensure it sits behind the button/connector if overlaps occur, though DOM order usually handles this. */}
        <div
          className={`absolute left-[9px] top-0 bottom-0 w-[2px] ${selfColorBg} z-0`}
        />

        {/* Curved Connector (L-shape) from line to avatar */}
        {/* Connects top (sibling/parent) to right (avatar) */}
        {/* Geometry Fix:
            - Avatar is centered at ~10px vertically (size-5 = 20px).
            - We want the horizontal line (bottom border) to hit Y=10px.
            - If div is height 12px, we place it at top -2px. (12 - 2 = 10px).
            - Width: Needs to reach from left-[9px] to center of next column (30px absolute).
            - Distance = 21px. w-5 is 20px. Close enough to touch the avatar.
        */}
        <div
          className={`absolute -top-0.5 left-[9px] h-3 w-5 rounded-bl-xl border-l-[2px] border-b-[2px] ${selfColorBorder} border-r-0 border-t-0 z-10`}
        />

        {/* Collapse/Expand Button */}
        {hasChildren && (
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse()
            }}
            // Center the button on the line (left-[9px] + 1px center = 10px).
            // Button is size-3 (12px). Left = 10 - 6 = 4px.
            // Top aligned near the curve/avatar center (10px). Top = 10 - 6 = 4px.
            className={`bg-background hover:bg-muted text-muted-foreground absolute top-[4px] left-[4px] z-20 flex size-3 items-center justify-center rounded-full border transition-colors ${selfColorBorder}`}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <Plus className='size-2' />
            ) : (
              <Minus className='size-2' />
            )}
          </button>
        )}
      </div>

      {/* 2. Main Content Column */}
      <div className='flex-1 mb-1 min-w-0'>
        {/* Header Row: Avatar + Body */}
        <div className='flex gap-2 pb-2'>
          {/* Avatar Area - No longer contains the line */}
          <div
            className={`flex ${AVATAR_SIZE} shrink-0 items-center justify-center`}
          >
            {avatar}
          </div>

          {/* Content Body */}
          <div className='min-w-0 flex-1 pt-0.5'>
            {isCollapsed ? collapsedContent : content}
          </div>
        </div>

        {/* Recursive Children - Indented by being in this column */}
        {hasChildren && !isCollapsed && (
          <div className='w-full mb-2'>{children}</div>
        )}
      </div>
    </div>
  )
}
