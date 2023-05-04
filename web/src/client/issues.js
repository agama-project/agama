/*
 * Copyright (c) [2023] SUSE LLC
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

/**
 * @typedef {object} ClientsIssues
 * @property {import ("~/client/mixins").Issue[]} storage - Issues from storage client
 */

/**
 * Client for managing all issues, independently on the service owning the issues
 */
class IssuesClient {
  /**
   * @param {object} clients - Clients managing issues
   * @param {import ("~/client/storage").StorageClient} clients.storage
   */
  constructor(clients) {
    this.clients = clients;
  }

  /**
   * Get issues from all clients managing issues
   *
   * @returns {Promise<ClientsIssues>}
   */
  async getAll() {
    const storage = await this.clients.storage.getIssues();

    return { storage };
  }

  /**
   * Checks whether there is some error
   *
   * @returns {Promise<boolean>}
   */
  async any() {
    const clientsIssues = await this.getAll();
    const issues = Object.values(clientsIssues).flat();

    return issues.length > 0;
  }

  /**
   * Registers a callback for each service to be executed when its issues change
   *
   * @param {import ("~/client/mixins").IssuesHandler} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onIssuesChange(handler) {
    const unsubscribeCallbacks = [];
    unsubscribeCallbacks.push(this.clients.storage.onIssuesChange(handler));

    return () => { unsubscribeCallbacks.forEach(cb => cb()) };
  }
}

export { IssuesClient };
