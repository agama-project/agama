/*
 * Copyright (c) [2024] SUSE LLC
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

import React from "react";
import { InstallerClientProvider } from "./installer";
import { InstallerL10nProvider } from "./installerL10n";
import { StorageUiStateProvider } from "./storage-ui-state";
import {
  DefaultOptions,
  MutationOptions,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { localConnection } from "~/utils";

// Determines which "network mode" should Tanstack Query use
//
// When running on a local connection, we assume that the server is always
// available so Tanstack Query is expected to perform all the request, no
// matter whether the network is available on not.
//
// For remote connections, let's use the default "online" mode.
//
// See https://tanstack.com/query/latest/docs/framework/react/guides/network-mode
const networkMode = (): "always" | "online" => {
  return localConnection() ? "always" : "online";
};

const sharedOptions: DefaultOptions & MutationOptions = {
  networkMode: networkMode(),
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...sharedOptions,
      /**
       * Structural sharing is disabled to ensure QueryCache subscriptions
       * receive 'updated' events even when refetched data is identical to
       * previous data.
       *
       * With structural sharing enabled (default), TanStack Query reuses the
       * previous data reference when new data is deeply equal, preventing the
       * QueryCache from emitting update events. This makes it impossible to
       * detect refetches via subscriptions when data hasn't changed.
       *
       * The custom useTrackQueriesRefetch hook (used by ProgressBackdrop)
       * relies on these events to detect when queries have been refetched,
       * enabling it to unblock the UI at the right moment when a progress has
       * finished and data for rendering the interface is ready. Without these
       * events, the UI cannot reliably determine when to unblock.
       *
       * The performance impact of disabling this optimization is expected to be
       * minimal because:
       *
       *   * Identical data responses are relatively rare in practice
       *   * React's reconciliation efficiently skips DOM updates when rendered
       *     output is identical, even if components re-render. Any heavy
       *     computations can be memoized to avoid re-execution when data hasn't
       *     changed
       *
       * Several alternatives were evaluated and rejected as unnecessarily complex
       * for the value provided:
       *
       *   * Adding artificial timestamps to JSON responses (which achieves
       *     nearly the same result as disabling this optimization, but at the
       *     cost of breaking types and polluting the data model)
       *   * Reverting useTrackQueriesRefetch to query observer pattern
       *   * Manually configuring notifyOnChangeProps globally or per-query
       *   * Implementing separate tracker queries alongside data queries
       *
       * This approach simply trades one render optimization for simpler, more
       * reliable event detection.
       *
       * @see https://tanstack.com/query/v5/docs/framework/react/guides/render-optimizations
       */
      structuralSharing: false,
    },
    mutations: sharedOptions,
  },
});

/**
 * Combines all application providers.
 */
function AppProviders({ children }: React.PropsWithChildren) {
  return (
    <InstallerClientProvider>
      <QueryClientProvider client={queryClient}>
        <InstallerL10nProvider>
          <StorageUiStateProvider>{children}</StorageUiStateProvider>
        </InstallerL10nProvider>
      </QueryClientProvider>
    </InstallerClientProvider>
  );
}

export { AppProviders };
