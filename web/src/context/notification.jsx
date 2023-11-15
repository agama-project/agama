/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useCallback, useContext, useEffect, useState } from "react";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "./installer";

const NotificationContext = React.createContext([{ issues: false }]);

function NotificationProvider({ children }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, setState] = useState({ issues: false });

  const update = useCallback(({ issues }) => {
    setState(s => ({ ...s, issues }));
  }, [setState]);

  const load = useCallback(async () => {
    if (!client) return;

    const issues = await cancellablePromise(client.issues());
    const hasIssues = Object.values(issues).flat().length > 0;
    update({ issues: hasIssues });
  }, [client, cancellablePromise, update]);

  useEffect(() => {
    if (!client) return;

    load();
    return client.onIssuesChange(load);
  }, [client, load]);

  const value = [state, update];

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/**
 * Returns the current notification state and a function to update the state
 * @function
 *
 * @typedef {object} NotificationState
 * @property {boolean} [issues] - Whether there is a notification for pending to read issues
 *
 * @callback NotificationStateUpdater
 * @param {NotificationState} state
 * @return {void}
 *
 * @returns {[NotificationState, NotificationStateUpdater]}
 */
function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }

  return context;
}

export { NotificationProvider, useNotification };
