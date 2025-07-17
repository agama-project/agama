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

import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  useDevices,
  availableDrivesQuery,
  candidateDrivesQuery,
  availableMdRaidsQuery,
  candidateMdRaidsQuery,
} from "~/queries/storage";
import { reactivate } from "~/api/storage";
import { StorageDevice } from "~/types/storage";

function findDevice(devices: StorageDevice[], sid: number): StorageDevice | undefined {
  const device = devices.find((d) => d.sid === sid);
  if (device === undefined) console.warn("Device not found:", sid);

  return device;
}

/**
 * Hook that returns the list of available drives for installation.
 */
const useAvailableDrives = (): StorageDevice[] => {
  const devices = useDevices("system", { suspense: true });
  const { data: sids } = useSuspenseQuery(availableDrivesQuery());

  return useMemo(() => {
    return sids.map((sid: number) => findDevice(devices, sid)).filter((d) => d);
  }, [devices, sids]);
};

/**
 * Hook that returns the list of candidate drives for installation.
 */
const useCandidateDrives = (): StorageDevice[] => {
  const devices = useDevices("system", { suspense: true });
  const { data: sids } = useSuspenseQuery(candidateDrivesQuery());

  return useMemo(() => {
    return sids.map((sid: number) => findDevice(devices, sid)).filter((d) => d);
  }, [devices, sids]);
};

/**
 * Hook that returns the list of available MD RAIDs for installation.
 */
const useAvailableMdRaids = (): StorageDevice[] => {
  const devices = useDevices("system", { suspense: true });
  const { data: sids } = useSuspenseQuery(availableMdRaidsQuery());

  return useMemo(() => {
    return sids.map((sid: number) => findDevice(devices, sid)).filter((d) => d);
  }, [devices, sids]);
};

/**
 * Hook that returns the list of available MD RAIDs for installation.
 */
const useCandidateMdRaids = (): StorageDevice[] => {
  const devices = useDevices("system", { suspense: true });
  const { data: sids } = useSuspenseQuery(candidateMdRaidsQuery());

  return useMemo(() => {
    return sids.map((sid: number) => findDevice(devices, sid)).filter((d) => d);
  }, [devices, sids]);
};

/**
 * Hook that returns the list of available devices for installation.
 */
const useAvailableDevices = (): StorageDevice[] => {
  const availableDrives = useAvailableDrives();
  const availableMdRaids = useAvailableMdRaids();

  return useMemo(
    () => [...availableDrives, ...availableMdRaids],
    [availableDrives, availableMdRaids],
  );
};

/**
 * Hook that returns the list of candidate devices for installation.
 */
const useCandidateDevices = (): StorageDevice[] => {
  const candidateDrives = useCandidateDrives();
  const candidateMdRaids = useCandidateMdRaids();

  return useMemo(
    () => [...candidateMdRaids, ...candidateDrives],
    [candidateDrives, candidateMdRaids],
  );
};

type ReactivateSystemFn = () => void;

function useReactivateSystem(): ReactivateSystemFn {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: reactivate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage"] }),
  };

  const { mutate } = useMutation(query);
  return mutate;
}

export {
  useAvailableDrives,
  useCandidateDrives,
  useAvailableMdRaids,
  useCandidateMdRaids,
  useAvailableDevices,
  useCandidateDevices,
  useReactivateSystem,
};

export type { ReactivateSystemFn };
