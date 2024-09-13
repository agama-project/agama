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

import { post, get } from "~/api/http";
import { ZFCPDisk, ZFCPController, ZFCPConfig } from "~/types/zfcp";

/**
 * Returns the list of zFCP controllers
 */
const fetchZFCPControllers = (): Promise<ZFCPController[]> => get("/api/storage/zfcp/controllers");

/**
 * Returns the list of zFCP disks
 */
const fetchZFCPDisks = (): Promise<ZFCPDisk[]> => get("/api/storage/zfcp/disks");

/**
 * Returns the global options for zFCP
 */
const fetchZFCPConfig = (): Promise<ZFCPConfig> => get("/api/storage/zfcp/config");


/**
 * Returns if zFCP is supported at all
 */
const ZFCPSupported = (): Promise<boolean> => get("/api/storage/zfcp/supported");

/**
 * probes zFCP devices
 */
const probeZFCP = () => post("/api/storage/zfcp/probe");

/**
 * Activates given controller
 * @param controllerId id of existing controller
 * @returns
 */
const activateZFCPController = (controllerId: string) => post(`/api/storage/zfcp/controllers/${controllerId}/activate`);

/**
 * Returns list of WWPNs for given controller
 * @param controllerId id of existing controller
 * @returns
 */
const fetchWWPNs = (controllerId: string): Promise<string[]> => get(`/api/storage/zfcp/controllers/${controllerId}/wwpns`);

/**
 * Returns list of LUNs for give controller and WWPN
 * @param controllerId
 * @param wwpn
 * @returns
 */
const fetchLUNs = (controllerId: string, wwpn: string): Promise<string[]> => get(`/api/storage/zfcp/controllers/${controllerId}/wwpns/${wwpn}/luns`);

/**
 * Actives disk on given controller with WWPN and LUN
 * @param controllerId
 * @param wwpn
 * @param lun
 * @returns
 */
const activateZFCPDisk = (controllerId: string, wwpn: string, lun: string) => post(`/api/storage/zfcp/controllers/${controllerId}/wwpns/${wwpn}/luns/${lun}/activate_disk`);

/**
 * Deactives disk on given controller with WWPN and LUN
 * @param controllerId
 * @param wwpn
 * @param lun
 * @returns
 */
const deactivateZFCPDisk = (controllerId: string, wwpn: string, lun: string) => post(`/api/storage/zfcp/controllers/${controllerId}/wwpns/${wwpn}/luns/${lun}/deactivate_disk`);



export {
  fetchZFCPControllers,
  fetchZFCPDisks,
  fetchZFCPConfig,
  probeZFCP,
  ZFCPSupported,
  activateZFCPController,
  fetchWWPNs,
  fetchLUNs,
  activateZFCPDisk,
  deactivateZFCPDisk,
};
