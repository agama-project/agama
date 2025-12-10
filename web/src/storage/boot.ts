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

import { copyApiModel } from "~/storage/api-model";
import { isTargetDevice } from "~/model/storage/config-model";
import { bootDevice } from "~/model/storage/config-model/boot";
import { usedMountPaths } from "~/model/storage/config-model/partitionable";
import type { model } from "~/storage";
import type { configModel } from "~/model/storage/config-model";

function isUsed(configModel: configModel.Config, device: model.Drive | model.MdRaid): boolean {
  return isTargetDevice(configModel, device.name) || usedMountPaths(device).length > 0;
}

function removeDevice(
  apiModel: configModel.Config,
  device: model.Drive | model.MdRaid,
): configModel.Config {
  apiModel.drives = apiModel.drives.filter((d) => d.name !== device.name);
  apiModel.mdRaids = apiModel.mdRaids.filter((d) => d.name !== device.name);
  return apiModel;
}

function setBoot(model: model.Model, apiModel: configModel.Config, boot: configModel.Boot) {
  const device = bootDevice(apiModel);
  // FIXME
  const modelDevice = model.drives.concat(model.mdRaids).find((d) => d.name === device?.name);
  if (device && !isUsed(apiModel, modelDevice)) removeDevice(apiModel, modelDevice);

  apiModel.boot = boot;
  return apiModel;
}

function setBootDevice(
  model: model.Model,
  apiModel: configModel.Config,
  deviceName: string,
): configModel.Config {
  apiModel = copyApiModel(apiModel);

  const boot: configModel.Boot = {
    configure: true,
    device: {
      default: false,
      name: deviceName,
    },
  };

  setBoot(model, apiModel, boot);
  return apiModel;
}

function setDefaultBootDevice(
  model: model.Model,
  apiModel: configModel.Config,
): configModel.Config {
  apiModel = copyApiModel(apiModel);

  const boot: configModel.Boot = {
    configure: true,
    device: {
      default: true,
    },
  };

  setBoot(model, apiModel, boot);
  return apiModel;
}

function disableBootConfig(model: model.Model, apiModel: configModel.Config): configModel.Config {
  apiModel = copyApiModel(apiModel);
  const boot: configModel.Boot = { configure: false };
  setBoot(model, apiModel, boot);
  return apiModel;
}

export { setBootDevice, setDefaultBootDevice, disableBootConfig };
