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

import { apiModel } from "~/api/storage";
import { data } from "~/types/storage";
import { switchSearched } from "~/helpers/storage/search";
import { copyApiModel } from "~/helpers/storage/api-model";

function addDrive(apiModel: apiModel.Config, data: data.Drive): apiModel.Config {
  apiModel = copyApiModel(apiModel);
  apiModel.drives ||= [];
  apiModel.drives.push(data);

  return apiModel;
}

function deleteDrive(apiModel: apiModel.Config, name: string): apiModel.Config {
  apiModel = copyApiModel(apiModel);
  apiModel.drives = apiModel.drives.filter((d) => d.name !== name);

  return apiModel;
}

function switchToDrive(
  apiModel: apiModel.Config,
  oldName: string,
  drive: data.Drive,
): apiModel.Config {
  return switchSearched(apiModel, oldName, drive.name, "drives");
}

export { addDrive, deleteDrive, switchToDrive };
