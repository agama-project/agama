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

import { useState, useEffect } from "react";
import { useInstallerClient } from "./context/installer";
import { useAuthContext } from "./context/auth";

import LoginForm from "./LoginForm";
import Overview from "./Overview";
import InstallationProgress from "./InstallationProgress";

function App() {
  const client = useInstallerClient();
  const {
    state: { loggedIn },
    autoLogin
  } = useAuthContext();
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(autoLogin, []);

  useEffect(() => {
    if (loggedIn === true) return;

    return client.onSignal("StatusChanged", (_path, _iface, _signal, args) => {
      setIsInstalling(args[0] !== 0);
    });
  }, []);

  if (!loggedIn) {
    return <LoginForm />;
  } else if (isInstalling) {
    return <InstallationProgress />;
  } else {
    return <Overview />;
  }
}

export default App;
