/*
 * Copyright (c) [2021-2023] SUSE LLC
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

// @ts-check

import { HTTPClient } from "./http";

/**
 * @typedef {object} InstallerClient
 * @property {() => import("./http").WSClient} ws - Agama WebSocket client.
 * @property {() => boolean} isConnected - determines whether the client is connected
 * @property {() => boolean} isRecoverable - determines whether the client is recoverable after disconnected
 * @property {(handler: () => void) => (() => void)} onConnect - registers a handler to run
 * @property {(handler: () => void) => (() => void)} onDisconnect - registers a handler to run
 *   when the connection is lost. It returns a function to deregister the
 *   handler.
 */

/**
 * Creates the Agama client
 *
 * @param {URL} url - URL of the HTTP API.
 * @return {InstallerClient}
 */
const createClient = (url) => {
  const client = new HTTPClient(url);
  // TODO: unify with the manager client

  const isConnected = () => client.ws().isConnected() || false;
  const isRecoverable = () => !!client.ws().isRecoverable();

  return {
    isConnected,
    isRecoverable,
    onConnect: (handler) => client.ws().onOpen(handler),
    onDisconnect: (handler) => client.ws().onClose(handler),
    ws: () => client.ws(),
  };
};

const createDefaultClient = async () => {
  const httpUrl = new URL(window.location.toString());
  return createClient(httpUrl);
};

export { createClient, createDefaultClient };
