/*
 * Copyright (c) [2025] SUSE LLC
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

import { useConfigModel } from "~/hooks/model/storage";
import { putStorageModel } from "~/api";
import configModel from "~/model/storage/config-model";
import type { Data } from "~/model/storage/config-model";

type AddReusedMdRaidFn = (data: Data.MdRaid) => void;

function useAddMdRaid(): AddReusedMdRaidFn {
  const config = useConfigModel();
  return (data: Data.MdRaid) => {
    putStorageModel(configModel.mdRaid.add(config, data));
  };
}

type DeleteMdRaidFn = (index: number) => void;

function useDeleteMdRaid(): DeleteMdRaidFn {
  const config = useConfigModel();
  return (index: number) => {
    putStorageModel(configModel.mdRaid.remove(config, index));
  };
}

type AddFromDriveFn = (oldName: string, raid: Data.MdRaid) => void;

function useAddFromDrive(): AddFromDriveFn {
  const config = useConfigModel();
  return (oldName: string, raid: Data.MdRaid) => {
    putStorageModel(configModel.mdRaid.addFromDrive(config, oldName, raid));
  };
}

export { useAddMdRaid, useDeleteMdRaid, useAddFromDrive };
export type { AddReusedMdRaidFn, DeleteMdRaidFn, AddFromDriveFn };
