/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import { get, put } from "../http";
import {
  Action,
  ProductParams,
  ProposalSettings,
  ProposalSettingsPatch,
  Volume,
} from "~/api/storage/types";

const fetchUsableDevices = (): Promise<number[]> => get(`/api/storage/proposal/usable_devices`);

const fetchProductParams = (): Promise<ProductParams> => get("/api/storage/product/params");

const fetchDefaultVolume = (mountPath: string): Promise<Volume | undefined> => {
  const path = encodeURIComponent(mountPath);
  return get(`/api/storage/product/volume_for?mount_path=${path}`);
};

const fetchSettings = (): Promise<ProposalSettings> => get("/api/storage/proposal/settings");

const fetchActions = (): Promise<Action[]> => get("/api/storage/proposal/actions");

const calculate = (settings: ProposalSettingsPatch) =>
  put("/api/storage/proposal/settings", settings);

export {
  fetchUsableDevices,
  fetchProductParams,
  fetchDefaultVolume,
  fetchSettings,
  fetchActions,
  calculate,
};
