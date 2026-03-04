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

import { useEffect } from "react";
import { isArrayEqual, remove, replaceOrAppend } from "radashi";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { getStatus } from "~/api";

import type { Status, Progress } from "~/model/status";

const statusQuery = {
  queryKey: ["status"],
  queryFn: getStatus,
};

function useStatus(): Status | null {
  return useSuspenseQuery(statusQuery)?.data;
}

function useStatusChanges() {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  // FIXME: refactor to use a single subscription.
  useEffect(() => {
    if (!client) return;

    return client.onEvent(({ type, progress, scope }) => {
      if (!progress && !scope) return;
      queryClient.setQueryData(["status"], (data: Status) => {
        let newProgresses: Progress[];

        if (type === "ProgressChanged") {
          newProgresses = replaceOrAppend(
            data.progresses,
            progress,
            (p) => p.scope === progress.scope,
          );
        }

        if (type === "ProgressFinished") {
          newProgresses = remove(data.progresses, (p) => p.scope === scope);
        }

        // Only set query data if progresses have changed
        if (newProgresses && !isArrayEqual(newProgresses, data.progresses)) {
          return { ...data, progresses: newProgresses };
        }
      });
    });
  }, [client, queryClient]);

  useEffect(() => {
    if (!client) return;

    return client.onEvent(({ type, stage }) => {
      if (!type && !stage) return;
      queryClient.setQueryData(["status"], (data: Status) => {
        if (type === "StageChanged") {
          return { ...data, stage };
        }
      });
    });
  }, [client, queryClient]);
}

export { useStatus, useStatusChanges };
