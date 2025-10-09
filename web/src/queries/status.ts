/*
 * Copyright (c) [2024] SUSE LLC
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

import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { fetchInstallerStatus } from "~/api/status";
import { useInstallerClient } from "~/context/installer";
import { InstallerStatus } from "~/types/status";
import { QueryHookOptions } from "~/types/queries";

const MANAGER_SERVICE = "org.opensuse.Agama.Manager1";

/**
 * Returns a query for retrieving the installer status
 */
const statusQuery = () => ({
  queryKey: ["status"],
  queryFn: fetchInstallerStatus,
});

/**
 * Hook that returns the installer status
 *
 * @param options - Query options
 */
const useInstallerStatus = (options?: QueryHookOptions): InstallerStatus | undefined => {
  const query = statusQuery();
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(query);
  return data;
};

/**
 * Hook that registers a useEffect to listen for status changes
 *
 * It listens for all status changes but updates the query only
 * if it is already cached.
 */
const useInstallerStatusChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      const { type } = event;
      const data = queryClient.getQueryData(["status"]) as object;

      switch (type) {
        case "InstallationPhaseChanged":
          if (!data) {
            console.warn("Ignoring InstallationPhaseChanged event", event);
          } else {
            const { phase } = event;
            queryClient.setQueryData(["status"], { ...data, phase });
          }
          break;
        case "ServiceStatusChanged":
          if (event.service === MANAGER_SERVICE) {
            if (!data) {
              console.warn("Ignoring ServiceStatusChanged event", event);
            } else {
              const { status } = event;
              queryClient.setQueryData(["status"], { ...data, isBusy: status === 1 });
            }
          }
          break;
      }
    });
  });
};

export { useInstallerStatus, useInstallerStatusChanges };
