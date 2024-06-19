/*
 * Copyright (c) [2024] SUSE LLC
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

import React, { useContext, useEffect, useState } from "react";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "./installer";
import { createIssuesList } from "~/client";

/**
 * @typedef {import ("~/client").Issues} Issues list
 */

const IssuesContext = React.createContext({});

function IssuesProvider({ children }) {
  const [issues, setIssues] = useState(createIssuesList());
  const { cancellablePromise } = useCancellablePromise();
  const client = useInstallerClient();

  useEffect(() => {
    const loadIssues = async () => {
      const issues = await cancellablePromise(client.issues());
      setIssues(issues);
    };

    if (client) {
      loadIssues();
    }
  }, [client, cancellablePromise, setIssues]);

  useEffect(() => {
    if (!client) return;

    return client.onIssuesChange((updated) => {
      setIssues({ ...issues, ...updated });
    });
  }, [client, issues, setIssues]);

  return <IssuesContext.Provider value={issues}>{children}</IssuesContext.Provider>;
}

/**
 * @return {Issues}
 */
function useIssues() {
  const context = useContext(IssuesContext);

  if (!context) {
    throw new Error("useIssues must be used within an IssuesProvider");
  }

  return context;
}

export { IssuesProvider, useIssues };
