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

import { applyMixin, withDBus } from "./mixins";

import cockpit from "../lib/cockpit";

export default class AuthClient {
  /**
   * Authorize using username and password
   *
   * @param {string} username - username
   * @param {string} password - password
   * @returns {Promise} resolves if the authencation was successful; rejects
   *   otherwise with an error message
   */
  authorize(username, password) {
    const auth = window.btoa(`${username}:${password}`);

    return new Promise((resolve, reject) => {
      return fetch("/cockpit/login", {
        headers: { Authorization: `Basic ${auth}`, "X-Superuser": "any" }
      }).then(resp => {
        if (resp.status == 200) {
          resolve(true);
        } else {
          reject(resp.statusText);
        }
      });
    });
  }

  /**
   * Determine whether a user is logged in
   *
   * @return {Promise.<boolean>} true if the user is logged in; false otherwise
   */
  isLoggedIn() {
    return new Promise((resolve, reject) => {
      return fetch("/cockpit/login")
        .then(resp => {
          resolve(resp.status === 200);
        })
        .catch(reject);
    });
  }

  /**
   * Return the current username
   *
   * @return {Promise.<string>}
   */
  currentUser() {
    return cockpit.user();
  }
}

applyMixin(AuthClient, withDBus);
