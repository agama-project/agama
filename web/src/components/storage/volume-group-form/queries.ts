/*
 * Copyright (c) [2026] SUSE LLC
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

/**
 * Query hooks for the volume group form.
 *
 * These compose route params with config model queries to derive the data the
 * form needs. They feed both the form's default values and the options of its
 * fields, so they live in one place to avoid duplication.
 */

import { useMemo } from "react";
import { useParams } from "react-router";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useVolumeGroup as useConfigModelVolumeGroup,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { isDrive, isMd } from "~/model/storage/device";

import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

/** Volume group config resolved from the `id` route param, or null. */
export function useVolumeGroupConfig(): ConfigModel.VolumeGroup | null {
  const { id: index } = useParams();
  return useConfigModelVolumeGroup(Number(index)) ?? null;
}

/**
 * Devices that can hold the physical volumes of a volume group: the drives and
 * the MD RAIDs that are not going to be formatted directly.
 */
export function useTargetDevices(): System.Device[] {
  const availableDevices = useAvailableDevices();
  const config = useConfigModel();

  return useMemo(
    () =>
      availableDevices
        .filter((d) => isDrive(d) || isMd(d))
        .filter((d) => !configModel.partitionable.findByName(config, d.name)?.filesystem),
    [availableDevices, config],
  );
}
