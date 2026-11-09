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
 * When the reader last saw the planned changes, kept for the whole session:
 * the installer is a single sitting, and a reload starting over is acceptable.
 * Entering the storage page counts as seeing them, and so does opening their
 * details.
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
 * Whether the planned changes arrived after the reader last saw them, and a
 * way to record that they have seen the latest ones.
 *
 * TODO: it only compares when the latest proposal arrived, so a proposal
 * fetched again with the same content also counts as new. Telling whether its
 * content changed, so a setting changed and set back clears it, is left for
 * later.
 */
function useUnseenChanges() {
  const { dataUpdatedAt } = useSuspenseQuery({ ...proposalQuery, select: () => null });
  const lastSeenAt = React.useSyncExternalStore(subscribe, read);
  const markCurrentSeen = React.useCallback(() => markSeen(dataUpdatedAt), [dataUpdatedAt]);

  /* The planned changes shown when entering the page are seen by being shown. */
  React.useEffect(() => {
    if (seenAt === null) markSeen(dataUpdatedAt);
  }, [dataUpdatedAt]);

  return {
    hasUnseenChanges: lastSeenAt !== null && dataUpdatedAt > lastSeenAt,
    markSeen: markCurrentSeen,
  };
}

export { useUnseenChanges };
