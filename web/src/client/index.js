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
import { HTTPClient } from "./http";

/**
 * @typedef {object} InstallerClient
 * @property {L10nClient} l10n - localization client.
 * @property {ManagerClient} manager - manager client.
 * property {Monitor} monitor - service monitor. (FIXME)
 * @property {NetworkClient} network - network client.
 * @property {ProductClient} product - product client.
 * @property {SoftwareClient} software - software client.
 * @property {StorageClient} storage - storage client.
 * @property {UsersClient} users - users client.
 * @property {QuestionsClient} questions - questions client.
 * @property {() => Promise<Issues>} issues - issues from all contexts.
 * @property {(handler: IssuesHandler) => (() => void)} onIssuesChange - registers a handler to run
 *  when issues from any context change. It returns a function to deregister the handler.
 * @property {() => boolean} isConnected - determines whether the client is connected
 * @property {() => boolean} isRecoverable - determines whether the client is recoverable after disconnected
 * @property {(handler: () => void) => (() => void)} onConnect - registers a handler to run
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
 * @property {Issue[]} [users] - Issues from users.
 * @property {boolean} [isEmpty] - Whether the list is empty
 *
 * @typedef {(issues: Issues) => void} IssuesHandler
 */

const createIssuesList = (product = [], software = [], storage = [], users = []) => {
  const list = { product, storage, software, users };
  list.isEmpty = !Object.values(list).some(v => v.length > 0);
  return list;
};

/**
 * Creates the Agama client
 *
 * @param {URL} url - URL of the HTTP API.
 * @return {InstallerClient}
 */
const createClient = url => {
  const client = new HTTPClient(url);
  const l10n = new L10nClient(client);
  // TODO: unify with the manager client
  const product = new ProductClient(client);
  const manager = new ManagerClient(client);
  // const monitor = new Monitor(address, MANAGER_SERVICE);
  const network = new NetworkClient(client);
  const software = new SoftwareClient(client);
  const storage = new StorageClient(client);
  const users = new UsersClient(client);
  const questions = new QuestionsClient(client);

  /**
   * Gets all issues, grouping them by context.
   *
   * TODO: issues are requested by several components (e.g., overview sections, notifications
   *  provider, issues page, storage page, etc). There should be an issues provider.
   *
   * @returns {Promise<Issues>}
   */
  const issues = async () => {
    const productIssues = await product.getIssues();
    const storageIssues = await storage.getIssues();
    const softwareIssues = await software.getIssues();
    const usersIssues = await users.getIssues();
    return createIssuesList(productIssues, softwareIssues, storageIssues, usersIssues);
  };

  /**
   * Registers a callback to be executed when issues change.
   *
   * @param {IssuesHandler} handler - Callback function.
   * @return {() => void} - Function to deregister the callback.
   */
  const onIssuesChange = handler => {
    const unsubscribeCallbacks = [];

    unsubscribeCallbacks.push(product.onIssuesChange(i => handler({ product: i })));
    unsubscribeCallbacks.push(storage.onIssuesChange(i => handler({ storage: i })));
    unsubscribeCallbacks.push(software.onIssuesChange(i => handler({ software: i })));
    unsubscribeCallbacks.push(users.onIssuesChange(i => handler({ users: i })));

    return () => {
      unsubscribeCallbacks.forEach(cb => cb());
    };
  };

  const isConnected = () => client.ws().isConnected() || false;
  const isRecoverable = () => !!client.ws().isRecoverable();

  return {
    l10n,
    product,
    manager,
    // monitor,
    network,
    software,
    storage,
    users,
    questions,
    issues,
    onIssuesChange,
    isConnected,
    isRecoverable,
    onConnect: handler => client.ws().onOpen(handler),
    onDisconnect: handler => client.ws().onClose(handler),
    ws: () => client.ws()
  };
};

const createDefaultClient = async () => {
  const httpUrl = new URL(window.location.toString());
  httpUrl.hash = "";
  return createClient(httpUrl);
};

export { createClient, createDefaultClient, phase, createIssuesList };
