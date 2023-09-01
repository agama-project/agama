/*
 * Copyright (c) [2022] SUSE LLC
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
import { useInstallerClient } from "~/context/installer";
import { STARTUP, INSTALL } from "~/client/phase";
import { BUSY } from "~/client/status";

import {
  About,
  Disclosure,
  Installation,
  IssuesLink,
  LoadingEnvironment,
  LogsButton,
  ShowLogButton,
  ShowTerminalButton,
  Sidebar
} from "~/components/core";
import { ChangeProductLink } from "~/components/software";
import { Layout, Title, DBusError } from "~/components/layout";

function App() {
  const client = useInstallerClient();
  const [status, setStatus] = useState(undefined);
  const [phase, setPhase] = useState(undefined);
  const [error, setError] = useState(undefined);

  useEffect(() => {
    const loadPhase = async () => {
      const phase = await client.manager.getPhase();
      const status = await client.manager.getStatus();
      setPhase(phase);
      setStatus(status);
    };

    loadPhase().catch(setError);
  }, [client.manager, setPhase, setStatus, setError]);

  useEffect(() => {
    return client.manager.onPhaseChange(setPhase);
  }, [client.manager, setPhase]);

  useEffect(() => {
    return client.monitor.onConnectionChange(connected => {
      connected ? location.reload() : setError(true);
    });
  }, [client.monitor, setError]);

  const Content = () => {
    if (error) return <DBusError />;

    if ((phase === STARTUP && status === BUSY) || phase === undefined || status === undefined) {
      return <LoadingEnvironment onStatusChange={setStatus} />;
    }

    if (phase === INSTALL) {
      return <Installation />;
    }

    return <Outlet />;
  };

  return (
    <>
      <Sidebar>
        <ChangeProductLink />
        <IssuesLink />
        <Disclosure label={_("Diagnostic tools")} data-keep-sidebar-open>
          <ShowLogButton />
          <LogsButton data-keep-sidebar-open="true" />
          <ShowTerminalButton />
        </Disclosure>
        <About />
      </Sidebar>

      <Layout>
        {/* this is the name of the tool, do not translate it */}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Title>Agama</Title>
        <Content />
      </Layout>
    </>
  );
}

export default App;
