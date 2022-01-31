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
  constructor() {
    // this.socket = new WebSocket(`${ws}`);
    // this.socket.onclose = () => console.log("The socket was closed");
  }

  onMessage(handler) {
    this.socket.addEventListener("message", handler);
  }

  authorize(username, password) {
    const auth = window.btoa(`${username}:${password}`);

    return new Promise((resolve, reject) => {
      return fetch(
        "/cockpit/login", { headers: {
          Authorization: `Basic ${auth}`,
          "X-Superuser": "any"
        }}).then(resp => {
          if (resp.status == 200) {
            resolve();
          } else {
            reject(resp.statusText);
          }
        });
    });
  }

  async getInstallation() {
    const { data }  = await axios.post(
      `${this.url}/calls`, { meth: "GetStatus" }
    );
    return { status: data };
  }

  async getProducts() {
    const { data } = await axios.post(
      `${this.url}/calls`, { meth: "GetProducts" }
    );
    return data;
  }

  async getLanguages() {
    const { data } = await axios.post(
      `${this.url}/calls`, { meth: "GetLanguages" }
    );
    return Object.keys(data).map(key => {
      return { id: key, name: data[key][1] }
    });
  }

  async getStorage() {
    const { data } = await axios.post(
      `${this.url}/calls`, { meth: "GetStorage" }
    );
    return data;
  }

  async getDisks() {
    const { data } = await axios.post(
      `${this.url}/calls`, { meth: "GetDisks" }
    );
    return data;
  }

  async getOptions() {
    const { data } = await axios.get(`${this.url}/properties`);
    return Object.fromEntries(
      Object.entries(data[0]).map(([k, v]) => [k.toLowerCase(), v])
    )
  }

  async getStatus() {
    const { data } = await axios.post(
      `${this.url}/calls`, { meth: "GetStatus" }
    );
    return data;
  }

  async setOptions(opts) {
    const promises = Object.keys(opts).map(name => {
      const key = name.charAt(0).toUpperCase() + name.slice(1);
      return axios.put(`${this.url}/properties/${key}`, { value: opts[name] })
    });
    const value = await Promise.all(promises);
    return value;
  }

  async startInstallation() {
    return await axios.post(
      `${this.url}/calls`, { meth: "Start" }
    );
  }
}
