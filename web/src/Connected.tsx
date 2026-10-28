/*
 * Copyright (c) [2021-2025] SUSE LLC
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
import { getInstallerClient, resetInstallerClient } from "~/client";
import { useInstallerClient } from "~/hooks/use-installer-client";
import Loading from "~/components/layout/Loading";
import ServerError from "~/components/core/ServerError";

/**
 * Renders its children only while the server is reachable.
 *
 * Until the connection is established it shows a loading indicator, and it
 * reports the problem when the connection drops and cannot be recovered.
 *
 * Companion of {@link Protected}, which guards the same tree on being logged
 * in.
 */
export default function Connected({ children }: React.PropsWithChildren) {
  const client = useInstallerClient();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getInstallerClient();

    // allow hot replacement for the clients code
    if (module.hot) {
      // if anything coming from `import ... from "~/client"` is updated then this hook is called
      module.hot.accept("~/client", function () {
        console.log("[Agama HMR] A client module has been updated");
        resetInstallerClient();
        getInstallerClient();
        console.log("[Agama HMR] Using new clients");
      });
    }
  }, []);

  useEffect(() => {
    if (!client) return;

    setConnected(client.isConnected());

    const forgetConnect = client.onConnect(() => {
      setConnected(true);
      setError(false);
    });

    const forgetClose = client.onClose(() => {
      setConnected(false);
      setError(!client.isRecoverable());
    });

    return () => {
      forgetConnect();
      forgetClose();
    };
  }, [client]);

  if (error) return <ServerError />;
  if (!connected) return <Loading />;

  return children;
}
