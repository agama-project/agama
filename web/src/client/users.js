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

import DBusClient from "./dbus";
import { WithValidation } from "./mixins";

const USERS_SERVICE = "org.opensuse.Agama.Manager1";
const USERS_IFACE = "org.opensuse.Agama.Users1";
const USERS_PATH = "/org/opensuse/Agama/Users1";

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
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(USERS_SERVICE, address);
  }

  /**
   * Returns the first user structure
   *
   * @return {Promise<User>}
   */
  async getUser() {
    const proxy = await this.client.proxy(USERS_IFACE);
    const [fullName, userName, password, autologin] = proxy.FirstUser;
    return { fullName, userName, password, autologin };
  }

  /**
   * Returns true if the root password is set
   *
   * @return {Promise<boolean>}
   */
  async isRootPasswordSet() {
    const proxy = await this.client.proxy(USERS_IFACE);
    return proxy.RootPasswordSet;
  }

  /**
   * Sets the first user
   *
   * @param {User} user - object with full name, user name, password and boolean for autologin
   * @return {Promise<UserResult>} returns an object with the result and the issues found if error
   */
  async setUser(user) {
    const proxy = await this.client.proxy(USERS_IFACE);
    const [result, issues] = await proxy.SetFirstUser(
      user.fullName,
      user.userName,
      user.password,
      user.autologin,
      {}
    );

    return { result, issues };
  }

  /**
   * Removes the first user
   *
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async removeUser() {
    const proxy = await this.client.proxy(USERS_IFACE);
    const result = await proxy.RemoveFirstUser();
    return result === 0;
  }

  /**
   * Sets the root password
   *
   * @param {String} password - plain text root password ( maybe allow client side encryption?)
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async setRootPassword(password) {
    const proxy = await this.client.proxy(USERS_IFACE);
    const result = await proxy.SetRootPassword(password, false);
    return result === 0;
  }

  /**
   * Clears the root password
   *
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async removeRootPassword() {
    const proxy = await this.client.proxy(USERS_IFACE);
    const result = await proxy.RemoveRootPassword();
    return result === 0;
  }

  /**
   * Returns the root's public SSH key
   *
   * @return {Promise<String>} SSH public key or an empty string if it is not set
   */
  async getRootSSHKey() {
    const proxy = await this.client.proxy(USERS_IFACE);
    return proxy.RootSSHKey;
  }

  /**
   * Sets root's public SSH Key
   *
   * @param {String} key - plain text root ssh key. Empty string means disabled
   * @return {Promise<boolean>} whether the operation was successful or not
   */
  async setRootSSHKey(key) {
    const proxy = await this.client.proxy(USERS_IFACE);
    const result = await proxy.SetRootSSHKey(key);
    return result === 0;
  }

  /**
   * Registers a callback to run when user properties change
   *
   * @param {(userSettings: UserSettings) => void} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onUsersChange(handler) {
    return this.client.onObjectChanged(USERS_PATH, USERS_IFACE, changes => {
      if (changes.RootPasswordSet) {
        // @ts-ignore
        return handler({ rootPasswordSet: changes.RootPasswordSet.v });
      } else if (changes.RootSSHKey) {
        return handler({ rootSSHKey: changes.RootSSHKey.v.toString() });
      } else if (changes.FirstUser) {
        // @ts-ignore
        const [fullName, userName, password, autologin] = changes.FirstUser.v;
        return handler({ firstUser: { fullName, userName, password, autologin } });
      }
    });
  }
}

/**
 * Client to interact with the Agama users service
 */
class UsersClient extends WithValidation(UsersBaseClient, USERS_PATH) { }

export { UsersClient };
