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

import React from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getSystem } from "~/api";
import { useInstallerClient } from "~/context/installer";
import type { System } from "~/model/system";

const systemQuery = {
  queryKey: ["system"],
  queryFn: getSystem,
};

function useSystem(): System | null {
  return useSuspenseQuery(systemQuery)?.data;
}

function useSystemChanges() {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    // TODO: replace the scope instead of invalidating the query.
    return client.onEvent((event) => {
      if (event.type === "SystemChanged") {
        queryClient.invalidateQueries({ queryKey: ["system"] });
        if (event.scope === "storage")
          queryClient.invalidateQueries({ queryKey: ["solvedStorageModel"] });
      }
    });
  }, [client, queryClient]);
}

export { systemQuery, useSystem, useSystemChanges };
export * as l10n from "~/hooks/model/system/l10n";
export * as storage from "~/hooks/model/system/storage";
export * as software from "~/hooks/model/system/software";
