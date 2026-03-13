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

import { useSuspenseQuery } from "@tanstack/react-query";
import { systemQuery } from "~/hooks/model/system";
import type { System, ZFCP } from "~/model/system";

const selectSystem = (system: System | null): ZFCP.System | null => system?.zfcp || null;

function useSystem(): ZFCP.System | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectSystem,
  });
  return data;
}

const selectControllers = (system: System | null): ZFCP.Controller[] =>
  system?.zfcp?.controllers || [];

function useControllers(): ZFCP.Controller[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectControllers,
  });
  return data;
}

const selectDevices = (system: System | null): ZFCP.Device[] => system?.zfcp?.devices || [];

function useDevices(): ZFCP.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectDevices,
  });
  return data;
}

type CheckLunScanFn = (channel: string) => boolean;

/**
 * Provides a function to check whether a zFCP controller is performing auto LUN scan.
 *
 * Auto LUN scan is available only if it is active in both the system and the controller.
 */
function useCheckLunScan(): CheckLunScanFn {
  const system = useSystem();
  return (channel: string): boolean =>
    [system?.lunScan, system?.controllers?.find((c) => c.channel === channel)?.lunScan].every(
      (c) => c === true,
    );
}

export type { CheckLunScanFn };
export { useSystem, useControllers, useDevices, useCheckLunScan };
