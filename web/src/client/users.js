/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import { WithValidation } from "./mixins";

const USERS_PATH = "/users/info"; // TODO: it should be /users/ when routing in rs is solved

/**
* @typedef {object} UserResult
* @property {boolean} result - whether the action succeeded or not
* @property {string[]} issues - issues found when applying the action
*/

/**
 * @typedef {object} User
 * @property {string} fullName - User full name
 * @property {string} userName - userName
 * @property {string} [password] - user password
 * @property {boolean} autologin - Whether autologin is enabled
 */

/**
* @typedef {object} UserSettings
* @property {User} [firstUser] - first user
* @property {boolean} [rootPasswordSet] - whether the root password is set
* @property {string} [rootSSHKey] - root SSH public key
*/

/**
 * Users client
 *
 * @ignore
 */
class UsersBaseClient {
  /**
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Returns the first user structure
   *
   * @return {Promise<User>}
   */
  async getUser() {
    const proxy = await this.client.get(USERS_PATH);
    console.log(proxy.user);
    if (proxy.user === null) {
      return { fullName: "", userName: "", password: "", autologin: false };
    }

    const [fullName, userName, password, autologin] = proxy.user;
    return { fullName, userName, password, autologin };
  }

  /**
   * Returns true if the root password is set
   *
   * @return {Promise<boolean>}
   */
  async isRootPasswordSet() {
    const proxy = await this.client.get(USERS_PATH);
    return proxy.root.password;
  }

  /**
   * Sets the first user
   *
   * @param {User} user - object with full name, user name, password and boolean for autologin
   * @return {Promise<UserResult>} returns an object with the result and the issues found if error
   */
  async setUser(user) {
    const result = await this.client.put("/users/user", user);

    return { result, issues: [] }; // TODO: check how to handle issues and result. Maybe separate call to validate?
  }

  /**
   * Removes the first user
   *
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async removeUser() {
    return this.client.delete("/users/user");
  }

  /**
   * Sets the root password
   *
   * @param {String} password - plain text root password ( maybe allow client side encryption?)
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async setRootPassword(password) {
    return this.client.put("/users/root_password", { value: password, encrypted: false });
  }

  /**
   * Clears the root password
   *
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async removeRootPassword() {
    return this.client.delete("/users/root_password");
  }

  /**
   * Returns the root's public SSH key
   *
   * @return {Promise<String>} SSH public key or an empty string if it is not set
   */
  async getRootSSHKey() {
    const proxy = await this.client.get(USERS_PATH);
    return proxy.root.password || "";
  }

  /**
   * Sets root's public SSH Key
   *
   * @param {String} key - plain text root ssh key. Empty string means disabled
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async setRootSSHKey(key) {
    return this.client.put("/users/root_sshkey", key);
  }

  /**
   * Registers a callback to run when user properties change
   *
   * @param {(userSettings: UserSettings) => void} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onUsersChange(handler) {
    return this.client.ws.onEvent((event) => {
      if (event.type === "RootPasswordChanged") {
        // @ts-ignore
        return handler({ rootPasswordSet: event.password_is_set });
      } else if (event.type === "RootSSHKeyChanged") {
        return handler({ rootSSHKey: event.key.toString() });
      } else if (event.type === "FirstUserChanged") {
        // @ts-ignore
        const { fullName, userName, password, autologin } = event;
        return handler({ firstUser: { fullName, userName, password, autologin } });
      }
    });
  }
}

/**
 * Client to interact with the Agama users service
 */
class UsersClient extends WithValidation(UsersBaseClient, "users/validation", "/org/opensuse/Agama/Users1") { }

export { UsersClient };
