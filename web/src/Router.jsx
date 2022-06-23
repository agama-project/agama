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
import { HashRouter, Routes, Route } from "react-router-dom";

import { PROBING, PROBED, INSTALLING, INSTALLED } from "./client/status";

import App from "./App";
import DBusError from "./DBusError";
import Overview from "./Overview";
import ProductSelection from "./ProductSelection";
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

const renderMainContent = (state) => {
  if (state.dbusError) return <DBusError />;
  if (state.loading) return <LoadingEnvironment />;
  if (state.probing) return <ProbingProgress />;
  if (state.installing) return <InstallationProgress />;
  if (state.finished) return <InstallationFinished />;

  return <Overview />;
};

function Router() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, null, init);

  useEffect(() => {
    client.manager.getStatus()
      .then(status => dispatch({ type: "CHANGE_STATUS", payload: { status } }))
      .catch(error => dispatch({ type: "SET_DBUS_ERROR", payload: { error } }));
  }, [client.manager]);

  useEffect(() => {
    return client.manager.onChange(changes => {
      console.log("manager has changed", changes);

      if ("Status" in changes) {
        dispatch({ type: "CHANGE_STATUS", payload: { status: changes.Status } });
      }
    });
  }, [client.manager]);

  useEffect(() => {
    return client.monitor.onDisconnect(() => {
      dispatch({ type: "SET_DBUS_ERROR", payload: { error: "Connection lost" } });
    });
  }, [client.monitor]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={renderMainContent(state)} />
        </Route>
        <Route path="products" element={<ProductSelection />} />
      </Routes>
    </HashRouter>
  );
}

export default Router;
