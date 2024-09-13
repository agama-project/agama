/*
 * Copyright (c) [2024] SUSE LLC
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

import { del, get, patch, post } from "~/api/http";
import { ISCSIInitiator, ISCSINode } from "~/api/storage/types";

const ISCSI_NODES_NAMESPACE = "/api/storage/iscsi/nodes";

const nodePath = (node: ISCSINode): string => ISCSI_NODES_NAMESPACE + "/" + node.id;

/**
 * Returns the iSCSI initiator.
 */
const fetchInitiator = (): Promise<ISCSIInitiator> => get("/api/storage/iscsi/initiator");

/**
 * Updates the name of the iSCSI initiator.
 */
const updateInitiator = ({ name }) => patch("/api/storage/iscsi/initiator", { name });

/**
 * Returns the iSCSI nodes.
 */
const fetchNodes = (): Promise<ISCSINode[]> => get("/api/storage/iscsi/nodes");

type LoginOptions = {
  // Password for authentication by target
  password?: string;
  // Username for authentication by target
  username?: string;
  // Password for authentication by initiator
  reversePassword?: string;
  // Username for authentication by initiator
  reverseUsername?: string;
};

/**
 * Performs an iSCSI discovery.
 *
 * @param address - IP address of the ISCSI server
 * @param port - Port of the iSCSI server
 * @param options - Authentication options
 * @return true on success, false on failure
 */
const discover = async (address: string, port: number, options: LoginOptions): Promise<boolean> => {
  const data = { address, port, options };
  try {
    await post("/api/storage/iscsi/discover", data);
    return true;
  } catch (error) {
    console.error("Error discovering iSCSI targets:", error.message);
    return false;
  }
};

const deleteNode = async (node: ISCSINode): Promise<void> => {
  await del(nodePath(node));
};

/*
 * Creates an iSCSI session on the given node.
 *
 * @param node - ISCSI node
 * @param options - Authentication options
 * @return operation result (0: success; 1: invalid startup; 2: failed)
 */
const login = async (node: ISCSINode, options: LoginOptions) => {
  try {
    await post(nodePath(node) + "/login", options);
    return 0;
  } catch (error) {
    const { data: reason } = error.response;
    console.warn("Could not login into the iSCSI node:", error.message, "reason:", reason);
    return reason === "InvalidStartup" ? 1 : 2;
  }
};

/*
 * Closes an iSCSI session on the given node.
 *
 * @param node - ISCSI node
 */
const logout = async (node: ISCSINode) => post(nodePath(node) + "/logout");

/**
 * Sets the startup status of the connection
 *
 * @param node - ISCSI node
 * @param startup - startup status
 */
const setStartup = async (node: ISCSINode, startup: string) => patch(nodePath(node), { startup });

export {
  fetchInitiator,
  fetchNodes,
  updateInitiator,
  discover,
  deleteNode,
  login,
  logout,
  setStartup,
};
export type { LoginOptions };
