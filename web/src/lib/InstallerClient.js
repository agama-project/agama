/*
 * Copyright (c) [2021] SUSE LLC
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

import axios from 'axios';

export default class InstallerClient {
  constructor(url) {
    this.url = url;
    const wsUrl = url.replace("http", "ws") + "/ws";
    this.socket = new WebSocket(`${wsUrl}`);
    this.socket.onclose = () => console.log("The socket was closed");
  }

  onMessage(handler) {
    this.socket.addEventListener("message", handler);
  }

  async getInstallation() {
    const { data } = await axios.get(`${this.url}/installation.json`);
    return data;
  }

  async getProducts() {
    const { data } = await axios.get(`${this.url}/products.json`);
    return data;
  }

  async getLanguages() {
    const { data } = await axios.get(`${this.url}/languages.json`);
    return data;
  }

  async getStorage() {
    const { data } = await axios.get(`${this.url}/storage.json`);
    return data;
  }

  async getDisks() {
    const { data } = await axios.get(`${this.url}/disks.json`);
    return data;
  }

  async getOptions() {
    const { data } = await axios.get(`${this.url}/options.json`);
    return data;
  }

  async setOptions(opts) {
    return await axios.put(`${this.url}/options.json`, opts);
  }

  async startInstallation() {
    return await axios.put(`${this.url}/installation.json`, { action: 'start' });
  }
}
