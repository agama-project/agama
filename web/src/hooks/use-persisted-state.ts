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

import { useCallback, useState } from "react";

/**
 * State hook whose value is mirrored to `localStorage` so it survives reloads.
 *
 * Behaves like `useState` but persists per-browser under the given key. Values
 * are JSON-encoded, so any serializable value works. Storage failures (e.g.
 * private mode, storage disabled) are ignored: the value still lives in React
 * state for the session.
 *
 * @param key - `localStorage` key to read from and write to.
 * @param defaultValue - value used when nothing is stored yet (or on a read error).
 *
 * @example
 *   const [name, setName] = usePersistedState<string>("user-name", "");
 */
export default function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? defaultValue : (JSON.parse(stored) as T);
    } catch {
      return defaultValue;
    }
  });

  const setPersistedState = useCallback(
    (value: T) => {
      setState(value);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Ignore write errors; the value is still applied for this session.
      }
    },
    [key],
  );

  return [state, setPersistedState];
}
