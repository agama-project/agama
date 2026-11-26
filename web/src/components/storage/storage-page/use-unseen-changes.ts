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

import React from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { proposalQuery } from "~/hooks/model/proposal";

/*
 * When the user last saw the planned changes, kept for the session. Entering
 * the storage page and opening the changes both count as seeing them.
 */
let seenAt: number | null = null;
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

const read = () => seenAt;

function markSeen(at: number) {
  if (seenAt === at) return;
  seenAt = at;
  listeners.forEach((listener) => listener());
}

/**
 * Whether the planned changes arrived after the user last saw them, and a way
 * to mark them as seen.
 *
 * TODO: only the arrival time is compared, so the same proposal fetched again
 * counts as new.
 */
function useUnseenChanges() {
  const { dataUpdatedAt } = useSuspenseQuery({ ...proposalQuery, select: () => null });
  const lastSeenAt = React.useSyncExternalStore(subscribe, read);
  const markCurrentSeen = React.useCallback(() => markSeen(dataUpdatedAt), [dataUpdatedAt]);

  /* Entering the page shows them. */
  React.useEffect(() => {
    if (seenAt === null) markSeen(dataUpdatedAt);
  }, [dataUpdatedAt]);

  return {
    hasUnseenChanges: lastSeenAt !== null && dataUpdatedAt > lastSeenAt,
    markSeen: markCurrentSeen,
  };
}

export { useUnseenChanges };
