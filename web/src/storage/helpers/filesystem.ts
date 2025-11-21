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

import { model } from "~/api/storage";
import { data } from "~/storage";
import { copyApiModel } from "~/storage/helpers/api-model";

function findDevice(
  apiModel: model.Config,
  list: string,
  index: number | string,
): model.Drive | model.MdRaid | null {
  return (apiModel[list] || []).at(index) || null;
}

function configureFilesystem(
  apiModel: model.Config,
  list: string,
  index: number | string,
  data: data.Formattable,
): model.Config {
  apiModel = copyApiModel(apiModel);

  const device = findDevice(apiModel, list, index);
  if (!device) return apiModel;

  device.mountPath = data.mountPath;

  if (data.filesystem) {
    device.filesystem = {
      default: false,
      ...data.filesystem,
    };
  } else {
    device.filesystem = undefined;
  }

  return apiModel;
}

export { configureFilesystem };
