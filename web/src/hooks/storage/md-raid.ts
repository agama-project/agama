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

import { useStorageModel } from "~/hooks/api/storage";
import { putStorageModel } from "~/api";
import { addReusedMdRaid, deleteMdRaid, switchToMdRaid } from "~/storage/md-raid";
import { data } from "~/storage";

type AddReusedMdRaidFn = (data: data.MdRaid) => void;

function useAddReusedMdRaid(): AddReusedMdRaidFn {
  const apiModel = useStorageModel();
  return (data: data.MdRaid) => {
    putStorageModel(addReusedMdRaid(apiModel, data));
  };
}

type DeleteMdRaidFn = (name: string) => void;

function useDeleteMdRaid(): DeleteMdRaidFn {
  const apiModel = useStorageModel();
  return (name: string) => {
    putStorageModel(deleteMdRaid(apiModel, name));
  };
}

type SwitchToMdRaidFn = (oldName: string, raid: data.MdRaid) => void;

function useSwitchToMdRaid(): SwitchToMdRaidFn {
  const apiModel = useStorageModel();
  return (oldName: string, raid: data.MdRaid) => {
    putStorageModel(switchToMdRaid(apiModel, oldName, raid));
  };
}

export { useAddReusedMdRaid, useDeleteMdRaid, useSwitchToMdRaid };
export type { AddReusedMdRaidFn, DeleteMdRaidFn, SwitchToMdRaidFn };
