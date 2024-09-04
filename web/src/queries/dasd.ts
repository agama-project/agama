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
  formatDASD,
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
  queryFn: () =>
    fetchStorageJobs().then((jobs) =>
      jobs.filter((j) => j.running).map(({ id }) => ({ jobId: id })),
    ),
  staleTime: 200,
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
        case "DASDFormatJobChanged": {
          const data = queryClient.getQueryData(["dasd", "formatJobs", "running"]) as FormatJob[];
          const nextData = data.map((job) => {
            if (job.jobId !== event.jobId) return job;

            return {
              ...job,
              summary: { ...job?.summary, ...event.summary },
            };
          });
          queryClient.setQueryData(["dasd", "formatJobs", "running"], nextData);
          break;
        }
        case "JobAdded": {
          const formatJob: FormatJob = { jobId: event.job.id };
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
            const res = prev.filter((dev) => dev.id !== id);
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
            const index = res.findIndex((dev) => dev.id === id);
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

const useDASDMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: ({ action, devices }: { action: string; devices: string[] }) => {
      switch (action) {
        case "enable": {
          return enableDASD(devices);
        }
        case "disable": {
          return disableDASD(devices);
        }
        case "diagOn": {
          return enableDiag(devices);
        }
        case "diagOff": {
          return disableDiag(devices);
        }
      }
    },
    onSuccess: (_: object, { action, devices }: { action: string; devices: string[] }) => {
      queryClient.setQueryData(["dasd", "devices"], (prev: DASDDevice[]) => {
        const nextData = prev.map((prevDev) => {
          const dev = { ...prevDev };
          if (devices.includes(dev.id)) {
            switch (action) {
              case "enable": {
                dev.enabled = true;
                break;
              }
              case "disable": {
                dev.enabled = false;
                break;
              }
              case "diagOn": {
                dev.diag = true;
                break;
              }
              case "diagOff": {
                dev.diag = false;
                break;
              }
            }
          }

          return dev;
        });

        return nextData;
      });
    },
  };

  return useMutation(query);
};

const useFormatDASDMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: formatDASD,
    onSuccess: (data: string) => {
      queryClient.setQueryData(["dasd", "formatJob", data], { jobId: data });
    },
  };

  return useMutation(query);
};

export {
  useDASDDevices,
  useDASDDevicesChanges,
  useDASDFormatJobChanges,
  useDASDRunningFormatJobs,
  useFormatDASDMutation,
  useDASDMutation,
};
