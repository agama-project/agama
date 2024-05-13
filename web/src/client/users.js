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
 * @property {object} data - additional user data
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
    const response = await this.client.get("/users/first");
    if (!response.ok) {
      console.log("Failed to get first user config: ", response);
      return { fullName: "", userName: "", password: "", autologin: false, data: {} };
    }
    return response.json();
  }

  /**
   * Returns true if the root password is set
   *
   * @return {Promise<boolean>}
   */
  async isRootPasswordSet() {
    const response = await this.client.get("/users/root");
    if (!response.ok) {
      console.log("Failed to get root config: ", response);
      return false;
    }
    const config = await response.json();
    return config.password;
  }

  /**
   * Sets the first user
   *
   * @param {User} user - object with full name, user name, password and boolean for autologin
   * @return {Promise<UserResult>} returns an object with the result and the issues found if error
   */
  async setUser(user) {
    const result = await this.client.put("/users/first", user);

    return { result: result.ok, issues: [] }; // TODO: check how to handle issues and result. Maybe separate call to validate?
  }

  /**
   * Removes the first user
   *
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async removeUser() {
    return (await this.client.delete("/users/first")).ok;
  }

  /**
   * Sets the root password
   *
   * @param {String} password - plain text root password ( maybe allow client side encryption?)
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async setRootPassword(password) {
    const response = await this.client.patch("/users/root", { password, password_encrypted: false });
    return response.ok;
  }

  /**
   * Clears the root password
   *
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async removeRootPassword() {
    return this.setRootPassword("");
  }

  /**
   * Returns the root's public SSH key
   *
   * @return {Promise<String>} SSH public key or an empty string if it is not set
   */
  async getRootSSHKey() {
    const response = await this.client.get("/users/root");
    if (!response.ok) {
      console.log("Failed to get root config: ", response);
      return "";
    }
    const config = await response.json();
    return config.sshkey;
  }

  /**
   * Sets root's public SSH Key
   *
   * @param {String} key - plain text root ssh key. Empty string means disabled
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async setRootSSHKey(key) {
    const response = await this.client.patch("/users/root", { sshkey: key });
    return response.ok;
  }

  /**
   * Registers a callback to run when user properties change
   *
   * @param {(userSettings: UserSettings) => void} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onUsersChange(handler) {
    return this.client.ws.onEvent((event) => {
      if (event.type === "RootChanged") {
        const res = {};
        if (event.password !== null) {
          res.rootPasswordSet = event.password;
        }
        if (event.sshkey !== null) {
          res.rootSSHKey = event.sshkey;
        }
        // @ts-ignore
        return handler(res);
      } else if (event.type === "FirstUserChanged") {
        // @ts-ignore
        const { fullName, userName, password, autologin, data } = event;
        return handler({ firstUser: { fullName, userName, password, autologin, data } });
      }
    });
  }
}

/**
 * Client to interact with the Agama users service
 */
class UsersClient extends WithValidation(UsersBaseClient, "/users/validation", "/org/opensuse/Agama/Users1") { }

export { UsersClient };
