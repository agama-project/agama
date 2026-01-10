/*
 * Copyright (c) [2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Custom hook that monitors multiple TanStack Query keys and triggers a
 * callback when all queries have been successfully refetched with fresh data.
 *
 * This hook subscribes to the specified queries and waits until each one
 * reports a `dataUpdatedAt` timestamp newer than when `startTracking()` was
 * called. Once all queries are updated, the `onSuccess` callback is
 * triggered and subscriptions are automatically cleaned up.
 *
 * @param queryKeys - Array of query key strings to track for refetches
 * @param onSuccess - Callback executed when considered all queries have
 *   refetched successfully. Receives the tracking start timestamp and completion
 *   timestamp.
 *
 * @returns Object containing the `startTracking` function to initiate tracking
 *
 * @example
 * ```tsx
 *   const { startTracking } = useTrackQueriesRefetch(
 *     ['users', 'posts', 'comments'],
 *     (startedAt, completedAt) => {
 *       console.log(`All queries refetched in ${completedAt - startedAt}ms`);
 *     })
 *   );
 *
 *   // Trigger refetch tracking
 *   const handleRefresh = () => {
 *     startTracking();
 *     queryClient.invalidateQueries(...);
 *   };
 * ```
 *
 * @remarks
 * - The hook automatically cleans up subscriptions on unmount
 * - Calling `startTracking` multiple times will cancel previous tracking cycles
 * - Only queries updated AFTER `startTracking()` is called are considered
 *   refetched
 * - If `queryKeys` is empty, `onSuccess` is called immediately
 * - Race conditions are prevented by tracking the start timestamp
 * - Duplicate query keys are automatically removed. Note that the hook
 *   recalculates when the queryKeys reference changes. For optimal performance,
 *   memoize queryKeys in the parent component if it changes frequently.
 *
 * @see {@link https://tanstack.com/query/latest/docs/react/reference/QueryObserver}
 */
function useTrackQueriesRefetch(
  queryKeys: readonly string[],
  onSuccess: (startedAt: number, completedAt: number) => void,
) {
  const queryClient = useQueryClient();

  // Remove duplicates and create Set for faster lookups when matching query keys
  const queryKeysSet = useMemo(() => new Set(queryKeys), [queryKeys]);

  // Tracks when the current tracking cycle started
  const startedAtRef = useRef<number | null>(null);

  // Helps to prevent duplicate onSuccess calls for the same tracking cycle
  const completedRef = useRef(false);

  // Stores which queries have been considered refetched in the current cycle
  const refetchedKeysRef = useRef<Set<string>>(new Set());

  // Stores the single unsubscribe function for queryCache subscription
  const unsubscribeRef = useRef<(() => void) | null>(null);

  /**
   * Cleans up all active subscriptions and resets tracking state.
   * Called when starting a new tracking cycle or on component unmount.
   */
  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    refetchedKeysRef.current.clear();
    startedAtRef.current = null;
    completedRef.current = false;
  }, []);

  /**
   * Completes the tracking cycle and invokes the success callback.
   */
  const finishTracking = useCallback(() => {
    if (completedRef.current || startedAtRef.current === null) return;

    completedRef.current = true;
    onSuccess(startedAtRef.current, Date.now());
    cleanup();
  }, [onSuccess, cleanup]);

  /**
   * Initiates tracking of query refetches.
   *
   * Creates QueryObservers for each query key and monitors their status. When
   * all queries are considered successfully refetched (their `dataUpdatedAt` is
   * later than the startedAt value), the `onSuccess` callback is triggered.
   *
   * Calling this function multiple times will cancel previous tracking cycles.
   */
  const startTracking = useCallback(() => {
    // Reset any previous tracking cycle
    cleanup();

    const startedAt = Date.now();
    startedAtRef.current = startedAt;

    // No queries to track, exit immediately
    if (queryKeysSet.size === 0) {
      finishTracking();
      return;
    }

    const refetchedKeys = refetchedKeysRef.current;

    // Subscribe to the query cache once for all queries
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Ignore events from stale tracking cycles (prevents race conditions)
      if (startedAtRef.current !== startedAt) return;

      // Only process 'updated' events
      if (event.type !== "updated") return;

      const query = event.query;
      const queryKey = query.queryKey[0] as string;

      // Check if this query is one we're tracking
      if (!queryKeysSet.has(queryKey)) return;

      // Check if this query can be considered as successfully refetched with fresh data
      if (
        query.state.status === "success" &&
        query.state.dataUpdatedAt > startedAt &&
        !refetchedKeys.has(queryKey)
      ) {
        refetchedKeys.add(queryKey);

        // Finish if all queries have completed refetching
        if (refetchedKeys.size === queryKeysSet.size) {
          finishTracking();
        }
      }
    });

    unsubscribeRef.current = unsubscribe;
  }, [queryClient, queryKeysSet, finishTracking, cleanup]);

  // Cleanup subscriptions on unmount
  useEffect(() => cleanup, [cleanup]);

  return { startTracking };
}

export default useTrackQueriesRefetch;
