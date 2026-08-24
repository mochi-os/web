// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The query and mutation layer shared by chess and go. Each app keeps its own
// move-history query, pass mutation and create mutation; response types are
// inferred from the app's own api client.

import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import {
  useQueryWithError,
  useInfiniteQueryWithError,
} from './use-query-with-error'

/** One page of chat messages. Both apps' message endpoint answers this shape. */
export interface GameMessagesPage {
  hasMore?: boolean
  nextCursor?: string
}

/**
 * The calls every game has. An app's own client has these and more; the extra
 * ones (chess's move history, go's pass) stay in the app.
 */
export interface GameApiShape {
  list: () => Promise<unknown>
  detail: (gameId: string) => Promise<unknown>
  messages: (
    gameId: string,
    options: { before?: string; limit?: number },
  ) => Promise<GameMessagesPage>
  sendMessage: (gameId: string, payload: never) => Promise<unknown>
  move: (gameId: string, payload: never) => Promise<unknown>
  resign: (gameId: string) => Promise<unknown>
  delete: (gameId: string) => Promise<unknown>
  getFriendsForNewGame: () => Promise<unknown>
}

/**
 * The draw calls, which not every game has. An api carrying all three is handed
 * the three draw hooks; one carrying none is handed none.
 */
export interface GameDrawApi {
  drawOffer: (gameId: string) => Promise<unknown>
  drawAccept: (gameId: string) => Promise<unknown>
  drawDecline: (gameId: string) => Promise<unknown>
}

const gameQueryKeys = {
  all: () => ['games'] as const,
  detail: (gameId: string) => ['games', gameId] as const,
  messages: (gameId: string) => ['games', gameId, 'messages'] as const,
  newGame: () => ['games', 'new'] as const,
}

const DEFAULT_PAGE_SIZE = 30

interface CreateGameHooksOptions {
  /**
   * Extra keys a move invalidates, on success and on failure alike. chess
   * passes its move-history key; go has no equivalent.
   */
  extraMoveKeys?: (gameId: string) => QueryKey[]
}

type Result<F> = F extends (...args: never[]) => Promise<infer R> ? R : never
type Payload<F> = F extends (id: string, payload: infer P) => unknown
  ? P
  : never

export function createGameHooks<A extends GameApiShape>(
  gamesApi: A,
  { extraMoveKeys }: CreateGameHooksOptions = {},
) {
  type GamesResponse = Result<A['list']>
  type ViewResponse = Result<A['detail']>
  type MessagesResponse = Result<A['messages']>
  type SendResponse = Result<A['sendMessage']>
  type MoveResponse = Result<A['move']>
  type ResignResponse = Result<A['resign']>
  type DrawResponse = A extends GameDrawApi ? Result<A['drawOffer']> : never
  type DeleteResponse = Result<A['delete']>
  type NewGameResponse = Result<A['getFriendsForNewGame']>

  const invalidateExtras = (queryClient: QueryClient, gameId: string) => {
    extraMoveKeys?.(gameId).forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey })
    })
  }

  const useGameDetailQuery = (
    gameId?: string,
    options?: Omit<
      UseQueryOptions<
        ViewResponse,
        Error,
        ViewResponse,
        ReturnType<typeof gameQueryKeys.detail>
      >,
      'queryKey' | 'queryFn'
    >,
  ) =>
    useQueryWithError({
      queryKey: gameQueryKeys.detail(gameId ?? 'unknown'),
      enabled: Boolean(gameId) && (options?.enabled ?? true),
      queryFn: () => {
        if (!gameId) {
          // eslint-disable-next-line lingui/no-unlocalized-strings -- thrown to the query's error boundary, never rendered
          throw new Error('Game ID is required')
        }
        return gamesApi.detail(gameId) as Promise<ViewResponse>
      },
      ...options,
    })

  const useGamesQuery = (
    options?: Pick<
      UseQueryOptions<
        GamesResponse,
        Error,
        GamesResponse,
        ReturnType<typeof gameQueryKeys.all>
      >,
      'enabled' | 'staleTime' | 'gcTime'
    >,
  ) =>
    useQueryWithError({
      queryKey: gameQueryKeys.all(),
      queryFn: () => gamesApi.list() as Promise<GamesResponse>,
      refetchInterval: 30000,
      ...options,
    })

  const useInfiniteMessagesQuery = (
    gameId?: string,
    options?: { enabled?: boolean },
  ) =>
    useInfiniteQueryWithError<
      MessagesResponse,
      Error,
      InfiniteData<MessagesResponse>,
      ReturnType<typeof gameQueryKeys.messages>,
      string | undefined
    >({
      queryKey: gameQueryKeys.messages(gameId ?? 'unknown'),
      enabled: Boolean(gameId) && (options?.enabled ?? true),
      initialPageParam: undefined,
      queryFn: ({ pageParam }) => {
        if (!gameId) {
          return Promise.resolve({ messages: [] } as MessagesResponse)
        }
        return gamesApi.messages(gameId, {
          before: pageParam,
          limit: DEFAULT_PAGE_SIZE,
        }) as Promise<MessagesResponse>
      },
      getNextPageParam: (lastPage, _allPages, _lastPageParam, allPageParams) => {
        if (!lastPage.hasMore) {
          return undefined
        }
        if (lastPage.nextCursor === undefined) {
          return undefined
        }
        if (allPageParams.includes(lastPage.nextCursor)) {
          return undefined
        }
        return lastPage.nextCursor
      },
    })

  const useSendMessageMutation = (
    options?: UseMutationOptions<
      SendResponse,
      Error,
      Payload<A['sendMessage']> & { gameId: string },
      unknown
    >,
  ) => {
    const queryClient = useQueryClient()
    const { onSuccess, ...restOptions } = options ?? {}
    return useMutation({
      mutationFn: ({ gameId, ...payload }) =>
        gamesApi.sendMessage(gameId, payload as never) as Promise<SendResponse>,
      onSuccess: (data, variables, context, mutation) => {
        queryClient.invalidateQueries({
          queryKey: gameQueryKeys.messages(variables.gameId),
        })
        onSuccess?.(data, variables, context, mutation)
      },
      ...restOptions,
    })
  }

  const useMoveMutation = (
    options?: UseMutationOptions<
      MoveResponse,
      Error,
      Payload<A['move']> & { gameId: string },
      unknown
    >,
  ) => {
    const queryClient = useQueryClient()
    const { onSuccess, onError, ...restOptions } = options ?? {}
    return useMutation({
      mutationFn: ({ gameId, ...payload }) =>
        gamesApi.move(gameId, payload as never) as Promise<MoveResponse>,
      onSuccess: (data, variables, context, mutation) => {
        queryClient.invalidateQueries({
          queryKey: gameQueryKeys.messages(variables.gameId),
        })
        queryClient.invalidateQueries({
          queryKey: gameQueryKeys.detail(variables.gameId),
          exact: true,
        })
        invalidateExtras(queryClient, variables.gameId)
        queryClient.invalidateQueries({
          queryKey: gameQueryKeys.all(),
          exact: true,
        })
        onSuccess?.(data, variables, context, mutation)
      },
      onError: (error, variables, context, mutation) => {
        // The board is advanced locally, so a rejected move leaves the client
        // showing a position the server never took - notably the 409 when the
        // position moved on under us. Refetch so the board snaps back.
        queryClient.invalidateQueries({
          queryKey: gameQueryKeys.detail(variables.gameId),
          exact: true,
        })
        invalidateExtras(queryClient, variables.gameId)
        onError?.(error, variables, context, mutation)
      },
      ...restOptions,
    })
  }

  const useNewGameFriendsQuery = (
    options?: Omit<
      UseQueryOptions<
        NewGameResponse,
        Error,
        NewGameResponse,
        ReturnType<typeof gameQueryKeys.newGame>
      >,
      'queryKey' | 'queryFn'
    >,
  ) =>
    useQueryWithError({
      queryKey: gameQueryKeys.newGame(),
      queryFn: () =>
        gamesApi.getFriendsForNewGame() as Promise<NewGameResponse>,
      ...options,
    })

  /**
   * The three end-of-game mutations differ only in which call they make and
   * whether the list needs refetching as well as the game.
   */
  const gameAction = <R>(
    call: (gameId: string) => Promise<unknown>,
    invalidatesList: boolean,
  ) =>
    function useGameAction(
      options?: UseMutationOptions<R, Error, { gameId: string }, unknown>,
    ) {
      const queryClient = useQueryClient()
      const { onSuccess, ...restOptions } = options ?? {}
      return useMutation({
        mutationFn: ({ gameId }: { gameId: string }) =>
          call(gameId) as Promise<R>,
        onSuccess: (data, variables, context, mutation) => {
          if (invalidatesList) {
            queryClient.invalidateQueries({
              queryKey: gameQueryKeys.all(),
              exact: true,
            })
          }
          queryClient.invalidateQueries({
            queryKey: gameQueryKeys.detail(variables.gameId),
            exact: true,
          })
          onSuccess?.(data, variables, context, mutation)
        },
        ...restOptions,
      })
    }

  const useResignMutation = gameAction<ResignResponse>(
    (gameId) => gamesApi.resign(gameId),
    true,
  )

  // Narrowed rather than required, so an api without the three still satisfies
  // GameApiShape. The non-null calls below only ever run through `drawHooks`,
  // which is spread in only when all three are present.
  const draws = gamesApi as Partial<GameDrawApi>
  const hasDraws =
    typeof draws.drawOffer === 'function' &&
    typeof draws.drawAccept === 'function' &&
    typeof draws.drawDecline === 'function'

  const drawHooks = {
    useDrawOfferMutation: gameAction<DrawResponse>(
      (gameId) => draws.drawOffer!(gameId),
      false,
    ),
    useDrawAcceptMutation: gameAction<DrawResponse>(
      (gameId) => draws.drawAccept!(gameId),
      true,
    ),
    useDrawDeclineMutation: gameAction<DrawResponse>(
      (gameId) => draws.drawDecline!(gameId),
      false,
    ),
  }

  const useDeleteGameMutation = (
    options?: UseMutationOptions<
      DeleteResponse,
      Error,
      { gameId: string },
      unknown
    >,
  ) => {
    const queryClient = useQueryClient()
    const { onSuccess, ...restOptions } = options ?? {}
    return useMutation({
      mutationFn: ({ gameId }: { gameId: string }) =>
        gamesApi.delete(gameId) as Promise<DeleteResponse>,
      onSuccess: (data, variables, context, mutation) => {
        queryClient.invalidateQueries({
          queryKey: gameQueryKeys.all(),
          exact: true,
        })
        onSuccess?.(data, variables, context, mutation)
      },
      ...restOptions,
    })
  }

  const base = {
    gameKeys: gameQueryKeys,
    useGameDetailQuery,
    useGamesQuery,
    useInfiniteMessagesQuery,
    useSendMessageMutation,
    useMoveMutation,
    useNewGameFriendsQuery,
    useResignMutation,
    useDeleteGameMutation,
  }

  // The cast is what lets one factory serve both: chess and go satisfy
  // GameDrawApi and see the draw hooks on the returned type, words does not and
  // does not. The runtime spread and the conditional type agree by
  // construction, since both key on the same three calls being present.
  return {
    ...base,
    ...(hasDraws ? drawHooks : {}),
  } as typeof base & (A extends GameDrawApi ? typeof drawHooks : object)
}
