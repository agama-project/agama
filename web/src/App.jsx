/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { _ } from "~/i18n";
import { useInstallerClient, useInstallerClientStatus } from "~/context/installer";
import { useProduct } from "./context/product";
import { STARTUP, INSTALL } from "~/client/phase";
import { BUSY } from "~/client/status";

import {
  About,
  DBusError,
  Disclosure,
  Installation,
  IssuesLink,
  LogsButton,
  ShowLogButton,
  ShowTerminalButton,
  Sidebar
} from "~/components/core";
import { InstallerKeymapSwitcher, InstallerLocaleSwitcher } from "./components/l10n";
import { Layout, Loading, Title } from "./components/layout";
import { useInstallerL10n } from "./context/installerL10n";

// D-Bus connection attempts before displaying an error.
const ATTEMPTS = 3;

/**
 * Main application component.
 *
 * @param {object} props
 * @param {number} [props.max_attempts=3] - Connection attempts before displaying an
 *   error (3 by default). The component will keep trying to connect.
 */
function App() {
  const client = useInstallerClient();
  const { attempt } = useInstallerClientStatus();
  const { products } = useProduct();
  const { language } = useInstallerL10n();
  const [status, setStatus] = useState(undefined);
  const [phase, setPhase] = useState(undefined);

  useEffect(() => {
    if (client) {
      return client.manager.onPhaseChange(setPhase);
    }
  }, [client, setPhase]);

  useEffect(() => {
    if (client) {
      return client.manager.onStatusChange(setStatus);
    }
  }, [client, setStatus]);

  useEffect(() => {
    const loadPhase = async () => {
      const phase = await client.manager.getPhase();
      const status = await client.manager.getStatus();
      setPhase(phase);
      setStatus(status);
    };

    if (client) {
      loadPhase().catch(console.error);
    }
  }, [client, setPhase, setStatus]);

  const Content = () => {
    if (!client || !products) {
      return (attempt > ATTEMPTS) ? <DBusError /> : <Loading />;
    }

    if ((phase === STARTUP && status === BUSY) || phase === undefined || status === undefined) {
      return <Loading />;
    }

    if (phase === INSTALL) {
      return <Installation status={status} />;
    }

    return <Outlet />;
  };

  return (
    <>
      <Sidebar>
        <div className="flex-stack">
          <IssuesLink />
          <Disclosure label={_("Diagnostic tools")} data-keep-sidebar-open>
            <ShowLogButton />
            <LogsButton data-keep-sidebar-open="true" />
            <ShowTerminalButton />
          </Disclosure>
          <About />
        </div>
        <div className="full-width highlighted">
          <div className="flex-stack">
            <InstallerLocaleSwitcher />
            <InstallerKeymapSwitcher />
          </div>
        </div>
      </Sidebar>

      <Layout>
        {/* this is the name of the tool, do not translate it */}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Title>Agama</Title>
        {language && <Content />}
      </Layout>
    </>
  );
}

export default App;
