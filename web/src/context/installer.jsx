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
import { Layout, Loading, Title } from "~/components/layout";
import { DBusError } from "~/components/core";

const InstallerClientContext = React.createContext(undefined);

/**
 * Returns the D-Bus installer client
 *
 * @return {import("~/client").InstallerClient}
 */
function useInstallerClient() {
  const context = React.useContext(InstallerClientContext);
  if (!context) {
    throw new Error("useInstallerClient must be used within a InstallerClientProvider");
  }

  return context;
}

const ATTEMPTS = 3;
const INTERVAL = 2000;

/**
  * @param {object} props
  * @param {import("~/client").InstallerClient|undefined} [props.client] client to connect to
  *   Agama service; if it is undefined, it instantiates a new one using the address
  *   registered in /run/agama/bus.address.
  * @param {number} [props.interval=2000] - Interval in milliseconds between connection attempts
  *   (2000 by default).
  * @param {number} [props.max_attempts=3] - Connection attempts before displaying an
  *   error (3 by default). The component will keep trying to connect.
  * @param {React.ReactNode} [props.children] - content to display within the provider
  */
function InstallerClientProvider({
  children, client = undefined, interval = INTERVAL, max_attempts = ATTEMPTS
}) {
  const [value, setValue] = useState(client);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const connectClient = async () => {
      const client = await createDefaultClient();
      if (await client.isConnected()) {
        setValue(client);
        setAttempts(0);
      }

      console.warn(`Failed to connect to D-Bus (attempt ${attempts + 1})`);
      await new Promise(resolve => setTimeout(resolve, interval));
      setAttempts(attempts + 1);
    };

    if (value === undefined) connectClient();
  }, [setValue, value, setAttempts, attempts, interval]);

  useEffect(() => {
    if (value === undefined) return;

    return value.onDisconnect(() => setValue(undefined));
  }, [value]);

  const Content = () => {
    if (value === undefined) {
      return (attempts > max_attempts) ? <DBusError /> : <Loading />;
    }

    return children;
  };

  return (
    <InstallerClientContext.Provider value={value}>
      <Layout>
        {/* this is the name of the tool, do not translate it */}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Title>Agama</Title>
        <Content />
      </Layout>
    </InstallerClientContext.Provider>
  );
}

export { InstallerClientProvider, useInstallerClient };
