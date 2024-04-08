/*
 * Copyright (c) [2021-2023] SUSE LLC
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

// @ts-check

import { L10nClient } from "./l10n";
import { ManagerClient } from "./manager";
import { Monitor } from "./monitor";
import { ProductClient, SoftwareClient } from "./software";
import { StorageClient } from "./storage";
import { UsersClient } from "./users";
import phase from "./phase";
import { QuestionsClient } from "./questions";
import { NetworkClient } from "./network";
import cockpit from "../lib/cockpit";
import { HTTPClient } from "./http";

/**
 * @typedef {object} InstallerClient
 * @property {L10nClient} l10n - localization client.
 * @property {ManagerClient} manager - manager client.
 * @property {Monitor} monitor - service monitor.
 * @property {NetworkClient} network - network client.
 * @property {ProductClient} product - product client.
 * @property {SoftwareClient} software - software client.
 * @property {StorageClient} storage - storage client.
 * @property {UsersClient} users - users client.
 * @property {QuestionsClient} questions - questions client.
 * @property {() => Promise<Issues>} issues - issues from all contexts.
 * @property {(handler: IssuesHandler) => (() => void)} onIssuesChange - registers a handler to run
 *  when issues from any context change. It returns a function to deregister the handler.
 * @property {() => Promise<boolean>} isConnected - determines whether the client is connected
 * @property {(handler: () => void) => (() => void)} onDisconnect - registers a handler to run
 *   when the connection is lost. It returns a function to deregister the
 *   handler.
 */

/**
 * @typedef {import ("~/client/mixins").Issue} Issue
 *
 * @typedef {object} Issues
 * @property {Issue[]} [product] - Issues from product.
 * @property {Issue[]} [storage] - Issues from storage.
 * @property {Issue[]} [software] - Issues from software.
 *
 * @typedef {(issues: Issues) => void} IssuesHandler
 */

/**
 * Creates the Agama client
 *
 * @param {URL} url - URL of the HTTP API.
 * @return {InstallerClient}
 */
const createClient = (url) => {
  const client = new HTTPClient(url);
  const l10n = new L10nClient(client);
  // TODO: unify with the manager client
  const product = new ProductClient(client);
  const manager = new ManagerClient(client);
  // const monitor = new Monitor(address, MANAGER_SERVICE);
  // const network = new NetworkClient(address);
  const software = new SoftwareClient(client);
  // const storage = new StorageClient(address);
  const users = new UsersClient(client);
  // const questions = new QuestionsClient(address);

  /**
   * Gets all issues, grouping them by context.
   *
   * TODO: issues are requested by several components (e.g., overview sections, notifications
   *  provider, issues page, storage page, etc). There should be an issues provider.
   *
   * @returns {Promise<Issues>}
   */
  // const issues = async () => {
  //   return {
  //     product: await software.product.getIssues(),
  //     storage: await storage.getIssues(),
  //     software: await software.getIssues(),
  //   };
  // };

  /**
   * Registers a callback to be executed when issues change.
   *
   * @param {IssuesHandler} handler - Callback function.
   * @return {() => void} - Function to deregister the callback.
   */
  const onIssuesChange = (handler) => {
    const unsubscribeCallbacks = [];

    // unsubscribeCallbacks.push(
    //   software.product.onIssuesChange((i) => handler({ product: i })),
    // );
    // unsubscribeCallbacks.push(
    //   storage.onIssuesChange((i) => handler({ storage: i })),
    // );
    // unsubscribeCallbacks.push(
    //   software.onIssuesChange((i) => handler({ software: i })),
    // );

    return () => {
      unsubscribeCallbacks.forEach((cb) => cb());
    };
  };

  const isConnected = async () => {
    // try {
    //   await manager.getStatus();
    //   return true;
    // } catch (e) {
    //   return false;
    // }
    return true;
  };

  return {
    l10n,
    product,
    manager,
    // monitor,
    // network,
    software,
    // storage,
    users,
    // questions,
    // issues,
    onIssuesChange,
    isConnected,
    onDisconnect: (handler) => {
      return () => {};
    },
    // onDisconnect: (handler) => monitor.onDisconnect(handler),
  };
};

const createDefaultClient = async () => {
  const httpUrl = new URL(window.location.toString());
  httpUrl.hash = "";
  return createClient(httpUrl);
};

export { createClient, createDefaultClient, phase };
