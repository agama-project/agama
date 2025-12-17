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

import React, { useMemo } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getProposal } from "~/api";
import { useInstallerClient } from "~/context/installer";
import type { Proposal } from "~/model/proposal";

import useTrackQueriesRefetch from "~/hooks/use-track-queries-refetch";

/**
 * Payload carried by the `proposal:updated` event.
 */
type ProposalUpdatedDetail = {
  /**
   * Timestamp (ms since epoch) indicating when the proposal update tracking
   * process started.
   */
  startedAt: number;

  /**
   * Timestamp (ms since epoch) indicating when the proposal update process
   * is considered finished.
   */
  completedAt: number;
};

/**
 * Event name dispatched when a proposal has finished updating.
 *
 * This event is used as a lightweight communication mechanism to notify
 * interested parts of the application when a proposal is considered fresh
 * after being invalidated and refetched at the TanStack Query level.
 *
 * The event is dispatched on `document` and carries timing information
 * about the proposal update lifecycle.
 */
const PROPOSAL_UPDATED_EVENT = "proposal:updated" as const;

/**
 * Subscribes to the `proposal:updated` event.
 *
 * The provided handler will be called every time the event is dispatched.
 *
 * @param handler Callback invoked with the event detail payload.
 *
 * @returns A cleanup function that MUST be called to unsubscribe the
 *          listener and prevent memory leaks.
 *
 * @remarks
 * This event-based API is intentionally DOM-based (`CustomEvent`) instead of
 * using a global state or pub/sub library, in order to:
 * - avoid extra dependencies
 * - keep cross-module communication explicit
 * - allow easy testing and inspection
 *
 * @example
 * Plain usage
 * ```ts
 * const unsubscribe = onProposalUpdated(({ startedAt, completedAt }) => {
 *   console.log(`Proposal update tracking started at ${new Date(startedAt)}`);
 *   console.log(`Proposal updated at ${new Date(completedAt)}`);
 * });
 *
 * // Later, when no longer needed
 * unsubscribe();
 * ```
 *
 * @example
 * Usage with React `useEffect`
 * ```ts
 * useEffect(() => {
 *   return onProposalUpdated(({ startedAt, completedAt }) => {
 *     console.log(`Proposal update tracking started at ${new Date(startedAt)}`);
 *     console.log(`Proposal updated at ${new Date(completedAt)}`);
 *     doSomethingElse();
 *   });
 * }, []);
 * ```
 */
function onProposalUpdated(handler: (detail: ProposalUpdatedDetail) => void) {
  const listener = (e: Event) => {
    const customEvent = e as CustomEvent<ProposalUpdatedDetail>;
    handler(customEvent.detail);
  };

  document.addEventListener(PROPOSAL_UPDATED_EVENT, listener);

  return () => document.removeEventListener(PROPOSAL_UPDATED_EVENT, listener);
}

/**
 * Dispatches the `proposal:updated` event.
 *
 * This should be called once a proposal update cycle has fully completed.
 * All active subscribers registered via `onProposalUpdated` will be
 * notified.
 *
 * @param detail Timing information about the update lifecycle.
 *
 * @example
 * ```ts
 * dispatchProposalUpdated({ startedAt, completedAt});
 * ```
 */
function dispatchProposalUpdated(detail: ProposalUpdatedDetail) {
  const event = new CustomEvent(PROPOSAL_UPDATED_EVENT, { detail });
  document.dispatchEvent(event);
}

const proposalQuery = {
  queryKey: ["proposal"],
  queryFn: getProposal,
};

function useProposal(): Proposal | null {
  return useSuspenseQuery(proposalQuery)?.data;
}

function useProposalChanges() {
  const queryClient = useQueryClient();
  const client = useInstallerClient();
  const queriesToInvalidate = useMemo(() => ["proposal", "extendedConfig", "storageModel"], []);
  const { startTracking } = useTrackQueriesRefetch(
    queriesToInvalidate,
    (startedAt, completedAt) => {
      dispatchProposalUpdated({ startedAt, completedAt });
    },
  );

  React.useEffect(() => {
    if (!client) return;

    // TODO: replace the scope instead of invalidating the query.
    return client.onEvent((event) => {
      if (event.type === "ProposalChanged") {
        queriesToInvalidate.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
        startTracking();
      }
    });
  }, [client, queryClient, queriesToInvalidate, startTracking]);
}

export { proposalQuery, useProposal, useProposalChanges, onProposalUpdated };
export * as l10n from "~/hooks/model/proposal/l10n";
export * as network from "~/hooks/model/proposal/network";
export * as storage from "~/hooks/model/proposal/storage";
export * as software from "~/hooks/model/proposal/software";
