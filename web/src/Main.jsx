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
import { useInstallerClient } from "./context/installer";
import { useSoftware } from "./context/software";

import { STARTUP, INSTALL } from "./client/phase";
import { BUSY } from "./client/status";

import { Outlet, Navigate } from "react-router-dom";
import Questions from "./Questions";
import DBusError from "./DBusError";
import InstallationProgress from "./InstallationProgress";
import InstallationFinished from "./InstallationFinished";
import LoadingEnvironment from "./LoadingEnvironment";

function Main() {
  const client = useInstallerClient();
  const [status, setStatus] = useState(undefined);
  const [phase, setPhase] = useState(undefined);
  const [error, setError] = useState(undefined);
  const { selectedProduct } = useSoftware();

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
    return client.manager.onStatusChange(setStatus);
  }, [client.manager, setStatus]);

  useEffect(() => {
    return client.monitor.onDisconnect(setError);
  }, [client.monitor, setError]);

  if (selectedProduct === null) {
    return <Navigate to="/products" />;
  }

  const Content = () => {
    if (error) return <DBusError />;

    if ((phase === STARTUP && status === BUSY) || selectedProduct === undefined || phase === undefined || status === undefined) {
      return <LoadingEnvironment />;
    }

    if (phase === INSTALL) {
      return (status === BUSY) ? <InstallationProgress /> : <InstallationFinished />;
    }

    return <Outlet />;
  };

  return (
    <>
      <Questions />
      <Content />
    </>
  );
}

export default Main;
