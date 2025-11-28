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

import { useCallback } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { systemQuery } from "~/hooks/api/system";
import { flatDevices, findDevices, findDeviceByName } from "~/api/system/storage";
import type { System, storage } from "~/api/system";

const selectSystem = (data: System | null): storage.System => data?.storage;

function useSystem(): storage.System | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectSystem,
  });
  return data;
}

const selectEncryptionMethods = (data: System | null): storage.EncryptionMethod[] =>
  data?.storage?.encryptionMethods || [];

function useEncryptionMethods(): storage.EncryptionMethod[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectEncryptionMethods,
  });
  return data;
}

const enum DeviceGroup {
  AvailableDrives = "availableDrives",
  CandidateDrives = "candidateDrives",
  AvailableMdRaids = "availableMdRaids",
  CandidateMdRaids = "candidateMdRaids",
}

function selectDeviceGroups(data: System | null, groups: DeviceGroup[]): storage.Device[] {
  if (!data?.storage) return [];
  const sids = groups.flatMap((g) => data.storage[g]);
  return findDevices(data.storage, sids);
}

const selectAvailableDrives = (data: System | null): storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.AvailableDrives]);

/**
 * Hook that returns the list of available drives for installation.
 */
function useAvailableDrives(): storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectAvailableDrives,
  });
  return data;
}

const selectCandidateDrives = (data: System | null): storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.CandidateDrives]);

/**
 * Hook that returns the list of candidate drives for installation.
 */
function useCandidateDrives(): storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectCandidateDrives,
  });
  return data;
}

const selectAvailableMdRaids = (data: System | null): storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.AvailableMdRaids]);

/**
 * Hook that returns the list of available MD RAIDs for installation.
 */
function useAvailableMdRaids(): storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectAvailableMdRaids,
  });
  return data;
}

const selectCandidateMdRaids = (data: System | null): storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.CandidateMdRaids]);

/**
 * Hook that returns the list of available MD RAIDs for installation.
 */
function useCandidateMdRaids(): storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectCandidateMdRaids,
  });
  return data;
}

const selectAvailableDevices = (data: System | null): storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.AvailableDrives, DeviceGroup.AvailableMdRaids]);

/**
 * Hook that returns the list of available devices for installation.
 */
function useAvailableDevices(): storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectAvailableDevices,
  });
  return data;
}

const selectCandidateDevices = (data: System | null): storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.CandidateDrives, DeviceGroup.CandidateMdRaids]);

/**
 * Hook that returns the list of candidate devices for installation.
 */
function useCandidateDevices(): storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectCandidateDevices,
  });
  return data;
}

const selectDevices = (data: System | null): storage.Device[] => data?.storage?.devices || [];

function useDevices(): storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectDevices,
  });
  return data;
}

const selectFlattenDevices = (data: System | null): storage.Device[] =>
  data?.storage ? flatDevices(data.storage) : [];

function useFlattenDevices(): storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectFlattenDevices,
  });
  return data;
}

function useDevice(name: string): storage.Device | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: useCallback(
      (data: System | null): storage.Device | null => {
        return data?.storage ? findDeviceByName(data.storage, name) : null;
      },
      [name],
    ),
  });
  return data;
}

const selectVolumeTemplates = (data: System | null): storage.Volume[] =>
  data?.storage?.volumeTemplates || [];

function useVolumeTemplates(): storage.Volume[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectVolumeTemplates,
  });
  return data;
}

const selectVolumeTemplate = (data: System | null, mountPath: string): storage.Volume | null => {
  const volumes = data?.storage?.volumeTemplates || [];
  return volumes.find((v) => v.mountPath === mountPath);
};

function useVolumeTemplate(mountPath: string): storage.Volume | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: useCallback((data) => selectVolumeTemplate(data, mountPath), [mountPath]),
  });
  return data;
}

const selectIssues = (data: System | null): storage.Issue[] => data?.storage?.issues || [];

function useIssues() {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectIssues,
  });
  return data;
}

export {
  useSystem,
  useEncryptionMethods,
  useAvailableDrives,
  useCandidateDrives,
  useAvailableMdRaids,
  useCandidateMdRaids,
  useAvailableDevices,
  useCandidateDevices,
  useDevices,
  useFlattenDevices,
  useDevice,
  useVolumeTemplates,
  useVolumeTemplate,
  useIssues,
};
