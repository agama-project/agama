/*
 * Copyright (c) [2021] SUSE LLC
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
import cockpit from "../lib/cockpit";
import { createClient } from "@/client";

const InstallerClientContext = React.createContext(undefined);

/**
 * Returns the D-Bus installer client
 *
 * @return {import("@client").InstallerClient}
 */
function useInstallerClient() {
  const context = React.useContext(InstallerClientContext);
  if (!context) {
    throw new Error("useInstallerClient must be used within a InstallerClientProvider");
  }

  return context;
}

const BUS_ADDRESS_FILE = "/run/d-installer/bus.address";

/**
  * @param {object} props
  * @param {import("@client").InstallerClient|undefined} [props.client] client to connect to
  *   D-Installer service; if it is undefined, it instantiates a new one using the address
  *   registered in /run/d-installer/bus.address.
  * @param {React.ReactNode} [props.children] - content to display within the provider
  */
function InstallerClientProvider({ client, children }) {
  const [value, setValue] = useState(client);

  useEffect(() => {
    if (client !== undefined) {
      const file = cockpit.file(BUS_ADDRESS_FILE);
      file.read().then(address => {
        setValue(createClient(address));
      });
    }
  }, [client]);

  if (!value) {
    return null;
  }

  return (
    <InstallerClientContext.Provider value={value}>{children}</InstallerClientContext.Provider>
  );
}

export { InstallerClientProvider, useInstallerClient };
