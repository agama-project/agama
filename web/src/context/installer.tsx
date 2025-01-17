/*
 * Copyright (c) [2021-2024] SUSE LLC
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

import React, { useState, useEffect } from "react";
import { createDefaultClient, InstallerClient } from "~/client";

type ClientStatus = {
  /** Whether the client is connected or not. */
  connected: boolean;
  /** Whether the client present an error and cannot reconnect. */
  error: boolean;
};

type InstallerClientProviderProps = React.PropsWithChildren<{
  /** Client to connect to Agama service; if it is undefined, it instantiates a
   * new one using the address registered in /run/agama/bus.address. */
  client?: InstallerClient;
}>;

const InstallerClientContext = React.createContext(null);
// TODO: we use a separate context to avoid changing all the codes to
// `useInstallerClient`. We should merge them in the future.
const InstallerClientStatusContext = React.createContext({
  connected: false,
  error: false,
});

/**
 * Returns the D-Bus installer client
 */
function useInstallerClient(): InstallerClient {
  const context = React.useContext(InstallerClientContext);
  if (context === undefined) {
    throw new Error("useInstallerClient must be used within a InstallerClientProvider");
  }

  return context;
}

/**
 * Returns the client status.
 */
function useInstallerClientStatus(): ClientStatus {
  const context = React.useContext(InstallerClientStatusContext);
  if (!context) {
    throw new Error("useInstallerClientStatus must be used within a InstallerClientProvider");
  }

  return context;
}

function InstallerClientProvider({ children, client = null }: InstallerClientProviderProps) {
  const [value, setValue] = useState(client);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const connectClient = async () => {
      const client = await createDefaultClient();
      setValue(client);
    };

    // allow hot replacement for the clients code
    if (module.hot) {
      // if anything coming from `import ... from "~/client"` is updated then this hook is called
      module.hot.accept("~/client", async function () {
        console.log("[Agama HMR] A client module has been updated");

        const updated_client = await createDefaultClient();
        console.log("[Agama HMR] Using new clients");
        setValue(updated_client);
      });
    }

    if (!value) connectClient();
  }, [setValue, value]);

  useEffect(() => {
    if (!value) return;

    value.onConnect(() => {
      setConnected(true);
      setError(false);
    });

    value.onClose(() => {
      setConnected(false);
      setError(!value.isRecoverable());
    });
  }, [value]);

  return (
    <InstallerClientContext.Provider value={value}>
      <InstallerClientStatusContext.Provider value={{ connected, error }}>
        {children}
      </InstallerClientStatusContext.Provider>
    </InstallerClientContext.Provider>
  );
}

export { InstallerClientProvider, useInstallerClient, useInstallerClientStatus };
