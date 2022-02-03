/*
 * Copyright (c) [2021] SUSE LLC
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

import React from 'react';
import { installationReducer } from './reducers';
import InstallerClient from '../lib/InstallerClient';
import actionTypes from './actionTypes';

const InstallerStateContext = React.createContext();
const InstallerDispatchContext = React.createContext();
const InstallerContext = React.createContext();

function useInstallerState() {
  const context = React.useContext(InstallerStateContext);
  if (!context) {
    throw new Error('useInstallerState must be used within a InstallerProvider');
  }

  return context;
}

function useInstallerDispatch() {
  const context = React.useContext(InstallerDispatchContext);
  if (!context) {
    throw new Error('useInstallerDispatch must be used within a InstallerProvider');
  }

  return context;
}

function useInstallerClient() {
  const context = React.useContext(InstallerContext);
  if (!context) {
    throw new Error('useInstallerDispatch must be used within a InstallerProvider');
  }

  return context;
}

function InstallerProvider({ client, children }) {
  const installerClient = client || new InstallerClient();
  const [state, dispatch] = React.useReducer(
    installationReducer, { status: 0, options: {} }
  );

  return (
    <InstallerContext.Provider value={installerClient}>
      <InstallerStateContext.Provider value={state}>
        <InstallerDispatchContext.Provider value={dispatch}>
        {children}
        </InstallerDispatchContext.Provider>
      </InstallerStateContext.Provider>
    </InstallerContext.Provider>
  );
}

function setStatus(dispatch) {
  installerClient().getStatus().then(installation => {
    dispatch({ type: actionTypes.SET_STATUS, payload: installation })
  }).catch(console.error);
}

function updateProgress(dispatch, progress)  {
  dispatch({ type: actionTypes.SET_PROGRESS, payload: progress });
}

function registerPropertyChangedHandler(handler) {
  installerClient().onPropertyChanged(handler);
}

function registerSignalHandler(signal, handler) {
  installerClient().onSignal(signal, handler);
}

function startInstallation(_dispatch) {
  installerClient().startInstallation();
}

/**
 * FIXME: needed to use a function in order to delay building the object and
 * make the tests to work
 */
let _installerClient;
const installerClient = () => {
    if (_installerClient) return _installerClient;

    _installerClient = new InstallerClient();
    return _installerClient;
};

export {
  InstallerProvider,
  useInstallerState,
  useInstallerDispatch,
  useInstallerClient,
  setStatus,
  updateProgress,
  startInstallation,
  registerPropertyChangedHandler,
  registerSignalHandler
};
