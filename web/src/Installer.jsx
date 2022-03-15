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

import DBusError from "./DBusError";
import Overview from "./Overview";
import InstallationProgress from "./InstallationProgress";
import InstallationFinished from "./InstallationFinished";
import statuses from "./lib/client/statuses";

const { PROBING, INSTALLING, INSTALLED } = statuses;
const inProgress = [PROBING, INSTALLING];

function Installer() {
  const client = useInstallerClient();
  // TODO: use reducer for states
  // set initial state to true to avoid async calls to dbus
  const [isProgress, setIsProgress] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [isDBusError, setIsDBusError] = useState(false);

  useEffect(async () => {
    try {
      const status = await client.manager.getStatus();
      setIsProgress(inProgress.includes(status));
      setIsFinished(status === INSTALLED);
    } catch (err) {
      console.error(err);
      setIsDBusError(false);
    }
  }, []);

  useEffect(() => {
    return client.manager.onChange(changes => {
      console.log("Problem is here!");
      if ("Status" in changes) {
        setIsProgress(inProgress.includes(changes.Status));
        setIsFinished(changes.Status == INSTALLED);
        setIsDBusError(false); // rescue when dbus start acting
      }
    });
  }, []);

  // TODO: add suppport for installation complete ui
  if (isDBusError) return <DBusError />;

  if (isFinished) return <InstallationFinished />;

  return isProgress ? <InstallationProgress /> : <Overview />;
}

export default Installer;
