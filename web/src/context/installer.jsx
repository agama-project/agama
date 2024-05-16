/*
 * Copyright (c) [2021-2023] SUSE LLC
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

// @ts-check

import React, { useState, useEffect } from "react";
import { createDefaultClient } from "~/client";

const InstallerClientContext = React.createContext(null);
// TODO: we use a separate context to avoid changing all the codes to
// `useInstallerClient`. We should merge them in the future.
const InstallerClientStatusContext = React.createContext({ connected: false, attempt: 0 });

/**
 * Returns the D-Bus installer client
 *
 * @return {import("~/client").InstallerClient}
 */
function useInstallerClient() {
  const context = React.useContext(InstallerClientContext);
  if (context === undefined) {
    throw new Error("useInstallerClient must be used within a InstallerClientProvider");
  }

  return context;
}

/**
 * Returns the client status.
 *
 * @typedef {object} ClientStatus
 * @property {boolean} connected - whether the client is connected
 * @property {number} attempt - number of attempt to connect
 *
 * @return {ClientStatus} installer client status
 */
function useInstallerClientStatus() {
  const context = React.useContext(InstallerClientStatusContext);
  if (!context) {
    throw new Error("useInstallerClientStatus must be used within a InstallerClientProvider");
  }

  return context;
}

const INTERVAL = 2000;

/**
  * @param {object} props
  * @param {import("~/client").InstallerClient|undefined} [props.client] client to connect to
  *   Agama service; if it is undefined, it instantiates a new one using the address
  *   registered in /run/agama/bus.address.
  * @param {number} [props.interval=2000] - Interval in milliseconds between connection attempt
  *   (2000 by default).
  * @param {React.ReactNode} [props.children] - content to display within the provider
  */
function InstallerClientProvider({
  children, client = null, interval = INTERVAL
}) {
  const [value, setValue] = useState(client);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const connectClient = async () => {
      const client = await createDefaultClient();
      if (await client.isConnected()) {
        setValue(client);
        setAttempt(0);
        return;
      }

      console.warn(`Failed to connect to Agama API (attempt ${attempt + 1})`);
      await new Promise(resolve => setTimeout(resolve, interval));
      setAttempt(attempt + 1);
    };

    // allow hot replacement for the clients code
    if (module.hot) {
      // if anything coming from `import ... from "~/client"` is updated then this hook is called
      module.hot.accept("~/client", async function() {
        console.log("[Agama HMR] A client module has been updated");

        const updated_client = await createDefaultClient();
        if (await updated_client.isConnected()) {
          console.log("[Agama HMR] Using new clients");
          setValue(updated_client);
        } else {
          console.warn("[Agama HMR] Updating clients failed, using full page reload");
          window.location.reload();
        }
      });
    }

    if (!value) connectClient();
  }, [setValue, value, setAttempt, attempt, interval]);

  useEffect(() => {
    if (!value) return;

    return value.onDisconnect(() => setValue(null));
  }, [value]);

  return (
    <InstallerClientContext.Provider value={value}>
      <InstallerClientStatusContext.Provider value={{ attempt, connected: !!value }}>
        {children}
      </InstallerClientStatusContext.Provider>
    </InstallerClientContext.Provider>
  );
}

export {
  InstallerClientProvider,
  useInstallerClient,
  useInstallerClientStatus
};
