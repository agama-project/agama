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
import { Outlet, Navigate } from "react-router-dom";

import { PROBING, PROBED, INSTALLING, INSTALLED } from "./client/status";

import DBusError from "./DBusError";
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
      return { ...state, ...init(action.payload.status) };
    }
    case "SET_DBUS_ERROR": {
      return { ...state, dbusError: action.payload.error };
    }
    case "LOAD_PRODUCTS": {
      return { ...state, products: action.payload.products };
    }
    default: {
      throw new Error(`Unsupported action type: ${action.type}`);
    }
  }
};

function App() {
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

  useEffect(() => {
    return client.software.getProducts()
      .then(products => {
        dispatch({ type: "LOAD_PRODUCTS", payload: { products } });
      });
  }, [client.software]);

  if (state.dbusError) return <DBusError />;
  if (state.loading || !state.products) return <LoadingEnvironment />;
  if (state.probing) return <ProbingProgress />;
  if (state.installing) return <InstallationProgress />;
  if (state.finished) return <InstallationFinished />;

  return <Outlet />;
}

export default App;
