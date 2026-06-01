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

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { shake } from "radashi";
import { getConfig, getExtendedConfig, putConfig } from "~/api";
import type { Config } from "~/model/config";
import type { AxiosResponse } from "axios";

const CONFIG_KEY = "config";
const EXTENDED_CONFIG_KEY = "extendedConfig";

const configQuery = {
  queryKey: [CONFIG_KEY],
  queryFn: getConfig,
};

function useConfig(): Config | null {
  return useSuspenseQuery(configQuery)?.data;
}

type UpdateConfigFn = (patch: Partial<Config>) => Promise<AxiosResponse>;

/**
 * Hook for updating config safely.
 *
 * Ensures that config updates are applied on top of a **fresh config**
 * from the backend, preventing accidental overrides of unrelated settings.
 *
 * ## Motivation
 *
 * Forms freeze their initial config on mount (via withFrozenQuery) to prevent
 * flickering and protect user edits from background refetches. But that same
 * freeze creates a risk at submit time: if the form used its frozen config as
 * the base for putConfig, any backend changes that happened while the user was
 * editing (websocket events, concurrent operations, background probes) would be
 * silently overwritten.
 *
 * Example without this hook:
 *  - Authentication form opens, freezes config at t=0
 *  - At t=30s, a background probe updates storage configuration in the backend
 *  - User submits authentication form at t=60s
 *  - putConfig is called with frozen config from t=0 → storage changes are lost
 *
 * With this hook, the base config is always fetched fresh at submit time, so
 * only the fields the user actually changed are affected.
 *
 * ## fetchQuery instead of useSuspenseQuery
 *
 * The natural instinct is to use useSuspenseQuery at the top of the hook:
 *
 * ```ts
 * // DO NOT DO THIS
 * function useUpdateConfig() {
 *   const { data: freshConfig } = useSuspenseQuery(configQuery);
 *   return (patch) => putConfig(shake({ ...freshConfig, ...patch }));
 * }
 * ```
 *
 * This has a stale closure problem. The returned function captures
 * `freshConfig` at render time. Because withFrozenQuery + React.memo
 * intentionally prevent the form from re-rendering on query refetches,
 * `freshConfig` inside the closure will be the value from the last render. This
 * may be old by the time the user submits. This is the same staleness problem
 * we were trying to solve.
 *
 * `queryClient.fetchQuery` fixes this by resolving the data at call time, not
 * render time. From the TanStack Query docs and TkDodo blog (the library's main
 * maintainer): "You can always call `queryClient.fetchQuery(...)` in your event
 * handler. It respects staleTime so it won't fetch if you have fresh data."
 * (https://github.com/TanStack/query/discussions/3754)
 *
 * This means:
 *  - If the cache is fresh (within staleTime): returns cached data immediately,
 *    no network request.
 *  - If the cache is stale: refetches from the backend before proceeding.
 *
 * A submit handler is an event handler, exactly the use case fetchQuery is
 * designed for. useSuspenseQuery is the right tool for subscribing a component
 * to reactive data for rendering; fetchQuery is the right tool for imperatively
 * reading data inside an event handler to build a write payload.
 *
 * ## Why shake lives here and not in the caller
 *
 * Callers express "delete this field" by passing undefined in the patch
 * (e.g. `{ user: undefined }` to remove the first user). The spread
 * `{ ...freshConfig, ...patch }` correctly propagates that undefined into the
 * merged object.
 *
 * However, the API might reject payloads containing undefined values. shake()
 * strips them before the request is sent. This is a transport-layer concern, it
 * has nothing to do with the domain logic of what the caller wants to express.
 * Keeping shake here means callers can use undefined naturally for deletions
 * without knowing anything about API constraints.
 *
 * If shake were in the caller, `{ user: undefined }` would be stripped before
 * reaching the hook, and the merge would leave the user key untouched in
 * freshConfig, silently breaking deletes.
 *
 * ## Usage
 *
 * ```tsx
 * const updateConfig = useUpdateConfig();
 *
 * // Update specific fields
 * await updateConfig({ user: newUser, root: newRoot });
 *
 * // Delete first user (undefined is intentional — shake handles API compat)
 * await updateConfig({ user: undefined });
 *
 * // Update unrelated field without touching others
 * await updateConfig({ hostname: newHostname });
 * ```
 */
function useUpdateConfig(): UpdateConfigFn {
  const queryClient = useQueryClient();

  return async (patch: Partial<Config>) => {
    // Resolved at call time (submit), not render time.
    // Returns cached data if within staleTime, refetches if stale.
    const freshConfig = await queryClient.fetchQuery(configQuery);

    return putConfig(shake({ ...freshConfig, ...patch }));
  };
}

const extendedConfigQuery = {
  queryKey: [EXTENDED_CONFIG_KEY],
  queryFn: getExtendedConfig,
};

function useExtendedConfig(): Config | null {
  return useSuspenseQuery(extendedConfigQuery)?.data;
}

export {
  CONFIG_KEY,
  EXTENDED_CONFIG_KEY,
  configQuery,
  extendedConfigQuery,
  useConfig,
  useUpdateConfig,
  useExtendedConfig,
};
export * as network from "~/hooks/model/config/network";
export * as product from "~/hooks/model/config/product";
export * as storage from "~/hooks/model/config/storage";
export * as iscsi from "~/hooks/model/config/iscsi";
export * as dasd from "~/hooks/model/config/dasd";
export * as zfcp from "~/hooks/model/config/zfcp";
