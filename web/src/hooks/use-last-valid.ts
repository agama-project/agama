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

/**
 * Custom React hook that returns the most recent `value` from when the
 * condition was satisfied.
 *
 *   - Returns `undefined` until the first time `condition` is `true`.
 *   - When `condition` is `true`, the hook updates its internal reference to the
 *   given `value`; otherwise, it still references the previously stored value.
 */
export function useLastValid<T>(value: T, condition: boolean): T | undefined {
  const [initialized, setInitialized] = useState(false);
  const lastValidRef = useRef<T>();

  useEffect(() => {
    if (condition) {
      lastValidRef.current = value;
      if (!initialized) setInitialized(true);
    }
  }, [value, condition, initialized]);

  return initialized ? lastValidRef.current : undefined;
}
