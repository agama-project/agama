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

import { post, get, put } from "~/api/http";
import { DASDDevice } from "~/types/dasd";

/**
 * Returns the list of DASD devices
 */
const fetchDASDDevices = (): Promise<DASDDevice[]> => get("/api/storage/dasd/devices");

/**
 * Returns if DASD is supported at all
 */
const DASDSupported = (): Promise<boolean> => get("/api/storage/dasd/supported");

/**
 * probes DASD devices
 */
const probeDASD = () => post("/api/storage/dasd/probe");

/**
 * Start format job for given list of devices
 * @param devicesIDs array of device ids
 * @return id of format job
 */
const DASDFormat = (devicesIDs: string[]): Promise<string> => post("/api/storage/dasd/format", { devices: devicesIDs }).then(({ data }) => data);

/**
 * Enables given list of devices
 * @param devicesIDs array of device ids
 */
const DASDEnable = (devicesIDs: string[]) => post("/api/storage/dasd/enable", { devices: devicesIDs });

/**
 * Enables given list of devices
 * @param devicesIDs array of device ids
 */
const DASDDisable = (devicesIDs: string[]) => post("/api/storage/dasd/disable", { devices: devicesIDs });

/**
 * Enables giag on given list of devices
 * @param devicesIDs array of device ids
 */
const diagEnable = (devicesIDs: string[]) => put("/api/storage/dasd/diag", { devices: devicesIDs, diag: true });

/**
 * Disables diag on given list of devices
 * @param devicesIDs array of device ids
 */
const diagDisable = (devicesIDs: string[]) => put("/api/storage/dasd/diag", { devices: devicesIDs, diag: false });


export { fetchDASDDevices, DASDSupported, DASDFormat, probeDASD, DASDEnable, DASDDisable, diagEnable, diagDisable };
