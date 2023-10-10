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
import { SidebarArea } from "~/components/layout";
import { LanguageSwitcher } from "./components/l10n";

function App() {
  const client = useInstallerClient();
  const [status, setStatus] = useState(undefined);
  const [phase, setPhase] = useState(undefined);

  useEffect(() => {
    const loadPhase = async () => {
      const phase = await client.manager.getPhase();
      const status = await client.manager.getStatus();
      setPhase(phase);
      setStatus(status);
    };

    loadPhase().catch(console.error);
  }, [client.manager, setPhase, setStatus]);

  useEffect(() => {
    return client.manager.onPhaseChange(setPhase);
  }, [client.manager, setPhase]);

  const Content = () => {
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
      <SidebarArea>
        <Sidebar>
          <div className="flex-stack">
            <ChangeProductLink />
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
              <LanguageSwitcher />
            </div>
          </div>
        </Sidebar>
      </SidebarArea>

      <Content />
    </>
  );
}

export default App;
