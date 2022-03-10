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

import React, { useState, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import Overview from "./Overview";
import InstallationProgress from "./InstallationProgress";

function Installer() {
  const client = useInstallerClient();
  // set initial state to true to avoid async calls to dbus
  const [isProgress, setIsProgress] = useState(true);


  useEffect(async () => {
    const status = await client.manager.getStatus();
    setIsProgress(status === 3 || status == 1);
  }, []);

  useEffect(() => {
    return client.onPropertyChanged((_path, _iface, _signal, args) => {
      const iface = "org.opensuse.DInstaller.Manager1";
      const [input_iface, changed] = args;
      if (input_iface === iface && "Status" in changed) {
        setIsProgress(changed.Status.v === 3 || changed.Status.v === 1);
      }
    });
  }, []);
  // TODO: add suppport for installation complete ui
  return isProgress ? <InstallationProgress /> : <Overview />;
}

export default Installer;
