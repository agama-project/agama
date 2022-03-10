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

import Client from "./client";
import cockpit from "../cockpit";

const STORAGE_PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage.Proposal1";
const STORAGE_ACTIONS_IFACE = "org.opensuse.DInstaller.Storage.Actions1";

export default class StorageClient extends Client {
  /**
   * Return the actions for the current proposal
   *
   * @return {Promise.<Array.<Object>>}
   */
  async getStorageActions() {
    const proxy = await this.proxy(STORAGE_ACTIONS_IFACE);
    return proxy.All.map(action => {
      const { Text: textVar, Subvol: subvolVar } = action.v;
      return { text: textVar.v, subvol: subvolVar.v };
    });
  }

  /**
   * Return storage proposal settings
   *
   * @return {Promise.<Object>}
   */
  async getStorageProposal() {
    const proxy = await this.proxy(STORAGE_PROPOSAL_IFACE);
    return {
      availableDevices: proxy.AvailableDevices.map(d => d.v),
      candidateDevices: proxy.CandidateDevices.map(d => d.v),
      lvm: proxy.LVM
    };
  }

  async calculateStorageProposal({ candidateDevices }) {
    const proxy = await this.proxy(STORAGE_PROPOSAL_IFACE);
    return proxy.Calculate({
      CandidateDevices: cockpit.variant("as", candidateDevices)
    });
  }
}
