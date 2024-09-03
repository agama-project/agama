/*
 * Copyright (c) [2024] SUSE LLC
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

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { _ } from "~/i18n";
import {
  disableDASD,
  disableDiag,
  enableDASD,
  enableDiag,
  fetchDASDDevices,
} from "~/api/dasd";
import { useInstallerClient } from "~/context/installer";
import React from "react";
import { hex } from "~/utils";
import { DASDDevice, FilterDASD, FormatJob } from "~/types/dasd";
import { fetchStorageJobs, findStorageJob } from "~/api/storage";

/**
 * Returns a query for retrieving the dasd devices
 */
const DASDDevicesQuery = () => ({
  queryKey: ["dasd", "devices"],
  queryFn: fetchDASDDevices,
});

/**
 * Hook that returns DASD devices.
 */
const useDASDDevices = () => {
  const { data: devices } = useSuspenseQuery(DASDDevicesQuery());
  return devices.map((d) => ({ ...d, hexId: hex(d.id) }));
};

/**
 * Returns a query for retrieving the running dasd format jobs
 */
const DASDRunningFormatJobsQuery = () => ({
  queryKey: ["dasd", "formatJobs", "running"],
  queryFn: () => fetchStorageJobs().then((jobs) => jobs.filter((j) => j.running).map(({ id }) => ({ jobId: id }))),
  staleTime: 200
});

/**
 * Hook that returns and specific DASD format job.
 */
const useDASDRunningFormatJobs = (): FormatJob[] => {
  const { data: jobs } = useSuspenseQuery(DASDRunningFormatJobsQuery());
  return jobs;
};

/**
 * Listens for DASD format job changes.
 */
const useDASDFormatJobChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent((event) => {
      // TODO: for simplicity we now just invalidate query instead of manually adding, removing or changing devices
      switch (event.type) {
        case ("DASDFormatJobChanged"): {
          const data = queryClient.getQueryData(["dasd", "formatJobs", "running"]) as FormatJob[];
          const nextData = data.map((job) => {
            if (job.jobId !== event.jobId) return job;

            return {
              ...job,
              summary: { ...job?.summary, ...event.summary }
            }
          });
          queryClient.setQueryData(["dasd", "formatJobs", "running"], nextData);
          break;
        }
        case ("JobAdded"): {
          const formatJob: FormatJob = { jobId: event.job.id }
          const data = queryClient.getQueryData(["dasd", "formatJobs", "running"]) as FormatJob[];
          data.push(formatJob);

          queryClient.setQueryData(["dasd", "formatJobs", "running"], data);
          break;
        }
        case "JobChanged": {
          const { id, running } = event.job;
          if (running) return;
          const data = queryClient.getQueryData(["dasd", "formatJobs", "running"]) as FormatJob[];
          const nextData = data.filter((j) => j.jobId !== id);
          if (data.length !== nextData.length) {
            queryClient.setQueryData(["dasd", "formatJobs", "running"], nextData);
          }
          break;
        }
      }
    });
  });

  const { data: jobs } = useSuspenseQuery(DASDRunningFormatJobsQuery());
  return jobs;
};

const useFormatDASDMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: FormatJob): Promise<FormatJob> => Promise.resolve(data),
    onSuccess: (data: FormatJob) => queryClient.setQueryData(["dasd", "formatJob", data.jobId], data)
  });

  return mutation;
};
/**
 * Returns seleced DASD ids
 */
const selectedDASDQuery = () => ({
  queryKey: ["dasd", "selected"],
  queryFn: () => {
    return Promise.resolve([]);
  },
  staleTime: Infinity,
});

const useSelectedDASD = (): DASDDevice[] => {
  const { data } = useQuery(selectedDASDQuery());

  return data || [];
}

const useSelectedDASDChange = () => {
  type SelectDASD = {
    unselect?: boolean,
    device?: DASDDevice,
    devices?: DASDDevice[]
  }

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: SelectDASD): Promise<SelectDASD> => Promise.resolve(data),
    onSuccess: (data: SelectDASD) => queryClient.setQueryData(["dasd", "selected"], (prev: DASDDevice[]) => {
      if (data.unselect) {
        if (data.device) return prev.filter((d) => d.id !== data.device.id);
        if (data.devices) return [];

      } else {
        if (data.device) return [...prev, data.device];
        if (data.devices) return data.devices;
      }
    }),
  });

  return mutation;
};

/**
 * Returns DASD filters
 */
const filterDASDQuery = () => ({
  queryKey: ["dasd", "filter"],
  queryFn: () => {
    return Promise.resolve({ minChannel: "", maxChannel: "" });
  },
  staleTime: Infinity,
});

const useFilterDASD = (): FilterDASD => {
  const { data } = useQuery(filterDASDQuery());

  return data || { minChannel: "", maxChannel: "" };
}

const useFilterDASDMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: FilterDASD): Promise<FilterDASD> => Promise.resolve(data),
    onSuccess: (data: FilterDASD) => {
      queryClient.setQueryData(["dasd", "filter"], (prev: FilterDASD) => ({
        ...prev,
        ...data
      }));
    },
  });

  return mutation;
};

/**
 * Listens for DASD devices changes.
 */
const useDASDDevicesChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent((event) => {
      switch (event.type) {
        case "DASDDeviceAdded": {
          const device: DASDDevice = event.device;
          queryClient.setQueryData(["dasd", "devices"], (prev: DASDDevice[]) => {
            // do not use push here as updater has to be immutable
            const res = prev.concat([device]);
            return res;
          });
          break;
        }
        case "DASDDeviceRemoved": {
          const device: DASDDevice = event.device;
          const { id } = device;
          queryClient.setQueryData(["dasd", "devices"], (prev: DASDDevice[]) => {
            const res = prev.filter(dev => dev.id !== id);
            return res;
          });
          break;
        }
        case "DASDDeviceChanged": {
          const device: DASDDevice = event.device;
          const { id } = device;
          queryClient.setQueryData(["dasd", "devices"], (prev: DASDDevice[]) => {
            // deep copy of original to have it immutable
            const res = [...prev];
            const index = res.findIndex(dev => dev.id === id);
            res[index] = device;
            return res;
          });
          break;
        }
      }
    });
  });

  const { data: devices } = useSuspenseQuery(DASDDevicesQuery());
  return devices;
};

export {
  useDASDDevices, useDASDDevicesChanges, useFilterDASDMutation, filterDASDQuery, useFilterDASD, useSelectedDASD, useSelectedDASDChange, selectedDASDQuery,
  useDASDFormatJobChanges, useDASDRunningFormatJobs, useFormatDASDMutation
};
