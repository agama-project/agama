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

import { useEffect, useRef, useState } from "react";
import { isUndefined } from "radashi";
import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";
import { useStatus } from "~/hooks/model/status";
import { COMMON_PROPOSAL_KEYS } from "~/hooks/model/proposal";
import type { Scope } from "~/model/status";

export function useProgress(scope?: Scope) {
  const { progresses } = useStatus();

  if (isUndefined(scope)) {
    return progresses;
  }

  return progresses.find((p) => p.scope === scope);
}

/**
 * Custom hook that manages loading state for operations with progress tracking.
 *
 * This hook coordinates between progress status from the backend and query
 * refetch completion to provide a seamless loading experience. It ensures the
 * UI remains in a loading state until both the backend operation completes AND
 * all related queries have been refetched with fresh data.
 *
 * @param scope - The progress scope to monitor (e.g., "software", "storage")
 * @param queryKeys - Array of TanStack Query keys to track for refetches after
 *   progress completes. Defaults to COMMON_PROPOSAL_KEYS if not provided.
 *
 * @returns Object containing:
 *   - `loading`: Boolean indicating whether an operation is in progress or
 *     waiting for queries to refetch
 *   - `progress`: The current progress object from the backend, or undefined
 *     if no matching progress is active
 *
 * @example
 * ```tsx
 * // Basic usage with default query keys
 * function SoftwareSummary() {
 *   const { loading } = useProgressTracking("software");
 *
 *   if (loading) return <Skeleton />;
 *   return <SoftwareSummary />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom query keys to ensure specific data is refetched
 * function ProgressBackdrop({ scope, ensureRefetched }) {
 *   const { loading: isBlocked, progress } = useProgressTracking(
 *     scope,
 *     [...COMMON_PROPOSAL_KEYS, ...ensureRefetched]
 *   );
 *
 *   if (!isBlocked) return null;
 *   return <Backdrop message={progress.message} />;
 * }
 * ```
 *
 * @remarks
 *
 * In short, the hook works as follow
 *
 *   1. Backend operation starts → `loading` becomes `true`
 *   2. Backend operation finishes → hook waits for queries to refetch
 *   3. useTrackQueriesRefetch reports all queries refetched with fresh data →
 *      `loading` becomes `false`
 *
 *  The hook uses a ref to track when the operation finished, ensuring queries
 *  are only considered "fresh" if they refetched AFTER the operation completed
 *  to prevents showing stale data to users.
 *
 * @see {@link useProgress} - For monitoring backend progress status
 * @see {@link useTrackQueriesRefetch} - For tracking query refetch completion
 */
export function useProgressTracking(
  scope?: Scope,
  queryKeys: readonly string[] = COMMON_PROPOSAL_KEYS,
) {
  const progress = useProgress(scope);
  const [loading, setLoading] = useState(false);
  const progressFinishedAtRef = useRef(null);

  const { startTracking } = useTrackQueriesRefetch(queryKeys, (_, completedAt) => {
    if (progressFinishedAtRef.current && completedAt > progressFinishedAtRef.current) {
      setLoading(false);
      progressFinishedAtRef.current = null;
    }
  });

  useEffect(() => {
    if (!progress && loading && !progressFinishedAtRef.current) {
      progressFinishedAtRef.current = Date.now();
      startTracking();
    }
  }, [progress, startTracking, loading, progressFinishedAtRef]);

  if (progress && !loading) {
    setLoading(true);
    progressFinishedAtRef.current = null;
  }

  return { loading, progress };
}
