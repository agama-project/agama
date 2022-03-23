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

const USERS_IFACE = "org.opensuse.DInstaller.Users1";

export default class UsersClient {
  constructor(dbusClient) {
    this._client = dbusClient;
  }

  /**
   * Return the first user structure
   *
   * @return {Promise.<Object>}
   */
  async getUser() {
    const proxy = await this.proxy(USERS_IFACE);
    const [fullName, userName, autologin] = proxy.FirstUser.map(u => u.v);
    return { fullName, userName, autologin };
  }

  /**
   * Return true if root password is set
   *
   * @return {Promise.<Boolean>}
   */
  async isRootPasswordSet() {
    const proxy = await this.proxy(USERS_IFACE);
    return proxy.RootPasswordSet;
  }

  /**
   * Return string with ssh key or empty string
   *
   * @return {Promise.<String>}
   */
  async getRootSSHKey() {
    const proxy = await this.proxy(USERS_IFACE);
    return proxy.RootSSHKey;
  }

  /**
   * Set the languages to install
   *
   * @param {object} user - object with full name, user name, password and boolean for autologin
   * @return {Promise.<String|undefined>}
   */
  async setUser(user) {
    const proxy = await this.proxy(USERS_IFACE);
    return proxy.SetFirstUser(user.fullName, user.userName, user.password, user.autologin, {});
  }

  /**
   * Set the root password
   *
   * @param {String} password - plain text root password ( maybe allow client side encryption?)
   * @return {Promise.<Number>}
   */
  async setRootPassword(password) {
    const proxy = await this.proxy(USERS_IFACE);
    return proxy.SetRootPassword(password, false);
  }

  /**
   * Clear the root password
   *
   * @return {Promise.<Number>}
   */
  async removeRootPassword() {
    const proxy = await this.proxy(USERS_IFACE);
    return proxy.RemoveRootPassword();
  }

  /**
   * Set the root SSH Key
   *
   * @param {String} key - plain text root ssh key. Empty string means disabled
   * @return {Promise.<Number>}
   */
  async setRootSSHKey(key) {
    const proxy = await this.proxy(USERS_IFACE);
    return proxy.SetRootSSHKey(key);
  }
}

applyMixin(UsersClient, withDBus);
