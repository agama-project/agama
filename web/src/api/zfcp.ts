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
import { ZFCPDisk, ZFCPController, ZFCPOptions } from "~/types/zfcp";

/**
 * Returns the list of zFCP controllers
 */
const fetchZFCPControllers = (): Promise<ZFCPController[]> => get("/api/storage/zfcp/controllers");

/**
 * Returns the list of zFCP disks
 */
const fetchZFCPDisks = (): Promise<ZFCPDisk[]> => get("/api/storage/zfcp/disks");

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
 * @param controller_id id of existing controller
 * @returns 
 */
const activateZFCPController = (controller_id: string) => post(`/api/storage/zfcp/controllers/${controller_id}/activate`);

/**
 * Returns list of WWPNs for given controller
 * @param controller_id id of existing controller
 * @returns 
 */
const fetchWWPNs = (controller_id: string): Promise<string[]> => get(`/api/storage/zfcp/controllers/${controller_id}/wwpns`);

/**
 * Returns list of LUNs for give controller and WWPN
 * @param controller_id 
 * @param wwpn 
 * @returns 
 */
const fetchLUNs = (controller_id: string, wwpn: string): Promise<string[]> => get(`/api/storage/zfcp/controllers/${controller_id}/wwpns/${wwpn}/luns`);

/**
 * Actives disk on given controller with WWPN and LUN
 * @param controller_id 
 * @param wwpn 
 * @param lun 
 * @returns 
 */
const activateZFCPDisk = (controller_id: string, wwpn:string, lun: string) => post(`/api/storage/zfcp/controllers/${controller_id}/wwpns/${wwpn}/luns/${lun}/activate_disk`);
const deactivateZFCPDisk = (controller_id: string, wwpn:string, lun: string) => post(`/api/storage/zfcp/controllers/${controller_id}/wwpns/${wwpn}/luns/${lun}/deactivate_disk`);

export {
  fetchZFCPControllers,
  fetchZFCPDisks,
  probeZFCP,
  ZFCPSupported,
  activateZFCPController,
  fetchWWPNs,
  fetchLUNs,
};
