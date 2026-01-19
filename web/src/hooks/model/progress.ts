/*
 * Copyright (c) [2026] SUSE LLC
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

import { isUndefined } from "radashi";
import { useStatus } from "./status";

import type { Progress, Scope } from "~/model/status";

/**
 * Convenience hook that returns the currently active progress(es).
 *
 *   - When no `scope` is provided, all active progress objects are returned.
 *   - When a `scope` is provided, only the progress associated with that scope
 *     is returned (or `undefined` if none exists).
 *
 * This hook is a lightweight wrapper around `useStatus`/`useState`. It is
 * intentionally defined in a separate file/module to enable proper testing:
 * consumers can mock progress data directly without depending on or
 * re-implementing the internal logic, which would be fragile and error-prone.
 *
 * An example of this kind of indirect testing can be found in the
 * `useProgressTracking` unit tests, which would not be possible if
 * `useStatus` and `useProgress` lived in the same file/module.
 */
export function useProgress(scope?: undefined): Progress[];
export function useProgress(scope: Scope): Progress | undefined;
export function useProgress(scope?: Scope): Progress[] | Progress | undefined {
  const { progresses } = useStatus();

  if (isUndefined(scope)) {
    return progresses;
  }

  return progresses.find((p) => p.scope === scope);
}
