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
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { System, storage } from "~/api/system";
import { QueryHookOptions } from "~/types/queries";
import { systemQuery } from "~/hooks/api";
import { findDevices } from "~/helpers/storage/system";

const selectSystem = (data: System | null): storage.System => data?.storage;

function useSystem(options?: QueryHookOptions): storage.System {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectSystem,
  });
  return data;
}

const selectEncryptionMethods = (data: System | null): storage.EncryptionMethod[] =>
  data?.storage?.encryptionMethods || [];

function useEncryptionMethods(options?: QueryHookOptions): storage.EncryptionMethod[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
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

const selectAvailableDrives = (data: System | null) =>
  selectDeviceGroups(data, [DeviceGroup.AvailableDrives]);

/**
 * Hook that returns the list of available drives for installation.
 */
function useAvailableDrives(options?: QueryHookOptions): storage.Device[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectAvailableDrives,
  });
  return data;
}

const selectCandidateDrives = (data: System | null) =>
  selectDeviceGroups(data, [DeviceGroup.CandidateDrives]);

/**
 * Hook that returns the list of candidate drives for installation.
 */
function useCandidateDrives(options?: QueryHookOptions): storage.Device[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectCandidateDrives,
  });
  return data;
}

const selectAvailableMdRaids = (data: System | null) =>
  selectDeviceGroups(data, [DeviceGroup.AvailableMdRaids]);

/**
 * Hook that returns the list of available MD RAIDs for installation.
 */
function useAvailableMdRaids(options?: QueryHookOptions): storage.Device[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectAvailableMdRaids,
  });
  return data;
}

const selectCandidateMdRaids = (data: System | null) =>
  selectDeviceGroups(data, [DeviceGroup.CandidateMdRaids]);

/**
 * Hook that returns the list of available MD RAIDs for installation.
 */
function useCandidateMdRaids(options?: QueryHookOptions): storage.Device[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectCandidateMdRaids,
  });
  return data;
}

const selectAvailableDevices = (data: System | null) =>
  selectDeviceGroups(data, [DeviceGroup.AvailableDrives, DeviceGroup.AvailableMdRaids]);

/**
 * Hook that returns the list of available devices for installation.
 */
function useAvailableDevices(options?: QueryHookOptions): storage.Device[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectAvailableDevices,
  });
  return data;
}

const selectCandidateDevices = (data: System | null) =>
  selectDeviceGroups(data, [DeviceGroup.CandidateDrives, DeviceGroup.CandidateMdRaids]);

/**
 * Hook that returns the list of candidate devices for installation.
 */
function useCandidateDevices(options?: QueryHookOptions): storage.Device[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectCandidateDevices,
  });
  return data;
}

const selectDevices = (data: System | null): storage.Device[] => data?.storage?.devices || [];

function useDevices(options?: QueryHookOptions): storage.Device[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectDevices,
  });
  return data;
}

const selectVolumeTemplates = (data: System | null): storage.Volume[] =>
  data?.storage?.volumeTemplates || [];

function useVolumeTemplates(options?: QueryHookOptions): storage.Volume[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: selectVolumeTemplates,
  });
  return data;
}

const selectVolumeTemplate = (data: System | null, mountPath: string): storage.Volume | null => {
  const volumes = data?.storage?.volumeTemplates || [];
  return volumes.find((v) => v.mountPath === mountPath);
};

function useVolumeTemplate(mountPath: string, options?: QueryHookOptions): storage.Volume | null {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
    select: useCallback((data) => selectVolumeTemplate(data, mountPath), [mountPath]),
  });
  return data;
}

const selectIssues = (data: System | null): storage.Issue[] => data?.storage?.issues || [];

function useIssues(options?: QueryHookOptions) {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...systemQuery(),
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
  useVolumeTemplates,
  useVolumeTemplate,
  useIssues,
};
