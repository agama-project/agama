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
import { systemQuery } from "~/hooks/model/system";
import { flatDevices, findDevices, findDeviceByName } from "~/model/system/storage";
import type { System, Storage } from "~/model/system";

const selectSystem = (data: System | null): Storage.System => data?.storage;

function useSystem(): Storage.System | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectSystem,
  });
  return data;
}

const selectEncryptionMethods = (data: System | null): Storage.EncryptionMethod[] =>
  data?.storage?.encryptionMethods || [];

function useEncryptionMethods(): Storage.EncryptionMethod[] {
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

function selectDeviceGroups(data: System | null, groups: DeviceGroup[]): Storage.Device[] {
  if (!data?.storage) return [];
  const sids = groups.flatMap((g) => data.storage[g]);
  return findDevices(data.storage, sids);
}

const selectAvailableDrives = (data: System | null): Storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.AvailableDrives]);

/**
 * Hook that returns the list of available drives for installation.
 */
function useAvailableDrives(): Storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectAvailableDrives,
  });
  return data;
}

const selectCandidateDrives = (data: System | null): Storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.CandidateDrives]);

/**
 * Hook that returns the list of candidate drives for installation.
 */
function useCandidateDrives(): Storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectCandidateDrives,
  });
  return data;
}

const selectAvailableMdRaids = (data: System | null): Storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.AvailableMdRaids]);

/**
 * Hook that returns the list of available MD RAIDs for installation.
 */
function useAvailableMdRaids(): Storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectAvailableMdRaids,
  });
  return data;
}

const selectCandidateMdRaids = (data: System | null): Storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.CandidateMdRaids]);

/**
 * Hook that returns the list of available MD RAIDs for installation.
 */
function useCandidateMdRaids(): Storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectCandidateMdRaids,
  });
  return data;
}

const selectAvailableDevices = (data: System | null): Storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.AvailableDrives, DeviceGroup.AvailableMdRaids]);

/**
 * Hook that returns the list of available devices for installation.
 */
function useAvailableDevices(): Storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectAvailableDevices,
  });
  return data;
}

const selectCandidateDevices = (data: System | null): Storage.Device[] =>
  selectDeviceGroups(data, [DeviceGroup.CandidateDrives, DeviceGroup.CandidateMdRaids]);

/**
 * Hook that returns the list of candidate devices for installation.
 */
function useCandidateDevices(): Storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectCandidateDevices,
  });
  return data;
}

const selectDevices = (data: System | null): Storage.Device[] => data?.storage?.devices || [];

function useDevices(): Storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectDevices,
  });
  return data;
}

const selectFlattenDevices = (data: System | null): Storage.Device[] =>
  data?.storage ? flatDevices(data.storage) : [];

function useFlattenDevices(): Storage.Device[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectFlattenDevices,
  });
  return data;
}

function useDevice(name: string): Storage.Device | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: useCallback(
      (data: System | null): Storage.Device | null => {
        return data?.storage ? findDeviceByName(data.storage, name) : null;
      },
      [name],
    ),
  });
  return data;
}

const selectVolumeTemplates = (data: System | null): Storage.Volume[] =>
  data?.storage?.volumeTemplates || [];

function useVolumeTemplates(): Storage.Volume[] {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectVolumeTemplates,
  });
  return data;
}

const selectVolumeTemplate = (data: System | null, mountPath: string): Storage.Volume | null => {
  const volumes = data?.storage?.volumeTemplates || [];
  return volumes.find((v) => v.mountPath === mountPath) || volumes.find((v) => v.mountPath === "");
};

function useVolumeTemplate(mountPath: string): Storage.Volume | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: useCallback((data) => selectVolumeTemplate(data, mountPath), [mountPath]),
  });
  return data;
}

const selectIssues = (data: System | null): Storage.Issue[] => data?.storage?.issues || [];

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
