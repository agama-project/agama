/*
 * Copyright (c) [2021-2024] SUSE LLC
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

import { WSClient, EventHandlerFn, ErrorHandlerFn, WSClientIface } from "./ws";

type VoidFn = () => void;
type BooleanFn = () => boolean;

export type InstallerClient = {
  /** Unique client identifier. */
  id?: string;
  /** Whether the client is connected. */
  isConnected: BooleanFn;
  /** Whether the client is recoverable after disconnecting. */
  isRecoverable: BooleanFn;
  /**
   * Registers a handler to run when connection is set. It returns a function
   * for deregistering the handler.
   */
  onConnect: (handler: VoidFn) => VoidFn;
  /**
   * Registers a handler to run when connection is closed. It returns a function
   * for deregistering the handler.
   */
  onClose: (handler: VoidFn) => VoidFn;
  /**
   * Registers a handler to run when there is an error. It returns a function
   * for deregistering the handler.
   */
  onError: (handler: ErrorHandlerFn) => VoidFn;
  /**
   * Registers a handler to run on events. It returns a function for
   * deregistering the handler.
   */
  onEvent: (handler: EventHandlerFn) => VoidFn;
};

/**
 * Creates the Agama client
 *
 * @param url - URL of the HTTP API.
 */
const createClient = (url: URL, wsClient?: WSClientIface): InstallerClient => {
  url.hash = "";
  url.pathname = url.pathname.concat("api/ws");
  url.protocol = url.protocol === "http:" ? "ws" : "wss";
  const ws = wsClient || new WSClient(url);

  const isConnected = () => ws.isConnected() || false;
  const isRecoverable = () => !!ws.isRecoverable();

  return {
    isConnected,
    isRecoverable,
    onConnect: (handler: VoidFn) => ws.onOpen(handler),
    onClose: (handler: VoidFn) => ws.onClose(handler),
    onError: (handler: ErrorHandlerFn) => ws.onError(handler),
    onEvent: (handler: EventHandlerFn) => ws.onEvent(handler),
  };
};

const createDefaultClient = async () => {
  const httpUrl = new URL(window.location.toString());
  return createClient(httpUrl);
};

/**
 * There is one connection to the server for the whole application, kept here
 * instead of in a component so that any module can reach it.
 */
let client: InstallerClient | null = null;
let creation: Promise<InstallerClient> | null = null;
const listeners = new Set<VoidFn>();

const notify = () => listeners.forEach((listener) => listener());

/**
 * Returns the client, creating it the first time it is asked for.
 *
 * Concurrent calls made before the client exists share the same creation, so
 * there is never more than one connection.
 */
const getInstallerClient = async (): Promise<InstallerClient> => {
  if (client) return client;

  creation ||= createDefaultClient().then((newClient) => {
    newClient.onEvent((event) => {
      if (event.type === "ClientConnected") newClient.id = event.clientId;
    });
    client = newClient;
    notify();
    return newClient;
  });

  return creation;
};

/**
 * The client, or null while it is still being created.
 */
const installerClient = (): InstallerClient | null => client;

/**
 * Registers a handler to run when the client is replaced. It returns a
 * function for deregistering the handler.
 */
const onInstallerClientChange = (handler: VoidFn): VoidFn => {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
};

/**
 * Forgets the current client, so the next request for it creates a new one.
 *
 * Needed by hot module replacement and by tests; the application itself keeps
 * one client for its whole life.
 */
const resetInstallerClient = () => {
  client = null;
  creation = null;
  notify();
};

export {
  createClient,
  createDefaultClient,
  getInstallerClient,
  installerClient,
  onInstallerClientChange,
  resetInstallerClient,
};
