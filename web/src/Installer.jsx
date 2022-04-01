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

import React, { useEffect, useReducer } from "react";
import { useInstallerClient } from "./context/installer";

import { PROBING, PROBED, INSTALLING, INSTALLED } from "./lib/client/status";

import DBusError from "./DBusError";
import Overview from "./Overview";
import ProbingProgress from "./ProbingProgress";
import InstallationProgress from "./InstallationProgress";
import InstallationFinished from "./InstallationFinished";
import LoadingEnvironment from "./LoadingEnvironment";

const init = status => ({
  loading: status === null,
  probing: status === PROBING,
  probed: status === PROBED,
  installing: status === INSTALLING,
  finished: status === INSTALLED,
  dbusError: null
});

const reducer = (state, action) => {
  switch (action.type) {
    case "CHANGE_STATUS": {
      return init(action.payload.status);
    }
    case "SET_DBUS_ERROR": {
      return { ...state, dbusError: action.payload.error };
    }
    default: {
      throw new Error(`Unsupported action type: ${action.type}`);
    }
  }
};

function Installer() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, null, init);

  useEffect(async () => {
    try {
      const status = await client.manager.getStatus();
      dispatch({ type: "CHANGE_STATUS", payload: { status } });
    } catch (error) {
      dispatch({ type: "SET_DBUS_ERROR", payload: { error } });
    }
  }, []);

  useEffect(() => {
    return client.manager.onChange(changes => {
      if ("Status" in changes) {
        dispatch({ type: "CHANGE_STATUS", payload: { status: changes.Status } });
      }
    });
  }, []);

  useEffect(() => {
    return client.monitor.onDisconnect(() => {
      dispatch({ type: "SET_DBUS_ERROR", payload: { error: "Connection lost" } });
    });
  }, []);
  
  return <InstallationFinished />;

  if (state.dbusError) return <DBusError />;
  if (state.loading) return <LoadingEnvironment />;
  if (state.probing) return <ProbingProgress />;
  if (state.installing) return <InstallationProgress />;
  if (state.finished) return <InstallationFinished />;

  return <Overview />;
}

export default Installer;
