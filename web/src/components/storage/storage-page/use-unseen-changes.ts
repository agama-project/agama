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
import { isEqual } from "radashi";
import { useProposal } from "~/hooks/model/proposal/storage";
import type { Storage } from "~/model/proposal";

/*
 * The proposal as it was the last time the planned changes were looked at,
 * kept for the whole session: the installer is a single sitting, and a reload
 * starting over is acceptable. Nothing is kept before the first look, so there
 * is nothing to compare with until then.
 */
let seen: Storage.Proposal | null = null;
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

const read = () => seen;

/** Records the proposal as seen, which is what opening its details does. */
function markSeen(proposal: Storage.Proposal | null) {
  seen = proposal;
  listeners.forEach((listener) => listener());
}

/**
 * Whether the planned storage changes differ from the ones last looked at,
 * and a way to record that they have been looked at now.
 *
 * The whole proposal counts, actions and final layout, since the details show
 * both. A setting changed and then set back by hand can lead to the same
 * proposal, which is not a change. Where two such proposals still differ in
 * something incidental, any new proposal counts as changed, which is still
 * right after an edit.
 */
function useUnseenChanges() {
  const proposal = useProposal();
  const lastSeen = React.useSyncExternalStore(subscribe, read);
  const markCurrentSeen = React.useCallback(() => markSeen(proposal), [proposal]);

  return {
    hasUnseenChanges: lastSeen !== null && proposal !== null && !isEqual(lastSeen, proposal),
    markSeen: markCurrentSeen,
  };
}

export { useUnseenChanges };
