/*
 * Copyright (c) [2026] SUSE LLC
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

import { useMemo } from "react";
import DevicesManager from "~/model/storage/devices-manager";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import {
  useFlattenDevices as useProposalDevices,
  useActions,
} from "~/hooks/model/proposal/storage";

/**
 * The devices before and after the planned changes, read from the computed
 * plan rather than the configuration, so it reports what will happen rather
 * than what was asked for.
 */
function useDevicesManager(): DevicesManager {
  const system = useSystemDevices();
  const staging = useProposalDevices();
  const actions = useActions();

  return useMemo(() => new DevicesManager(system, staging, actions), [system, staging, actions]);
}

export { useDevicesManager };
