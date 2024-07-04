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

import React from "react";
import { useRevalidator } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { timezoneUTCOffset } from "~/utils";

const configQuery = () => {
  return {
    queryKey: ["l10n", "config"],
    queryFn: () => fetch("/api/l10n/config").then((res) => res.json()),
  };
};

const localesQuery = () => ({
  queryKey: ["l10n", "locales"],
  queryFn: async () => {
    const response = await fetch("/api/l10n/locales");
    const locales = await response.json();
    return locales.map(({ id, language, territory }) => {
      return { id, name: language, territory };
    });
  },
  staleTime: Infinity
});

const timezonesQuery = () => ({
  queryKey: ["l10n", "timezones"],
  queryFn: async () => {
    const response = await fetch("/api/l10n/timezones");
    const timezones = await response.json();
    return timezones.map(({ code, parts, country }) => {
      const offset = timezoneUTCOffset(code);
      return { id: code, parts, country, utcOffset: offset };
    });
  },
  staleTime: Infinity
});

const keymapsQuery = () => ({
  queryKey: ["l10n", "keymaps"],
  queryFn: async () => {
    const response = await fetch("/api/l10n/keymaps");
    const json = await response.json();
    const keymaps = json.map(({ id, description }) => {
      return { id, name: description };
    });
    return keymaps.sort((a, b) => (a.name < b.name) ? -1 : 1);
  },
  staleTime: Infinity
});

const useConfigMutation = () => {
  const queryClient = useQueryClient();

  const query = {
    mutationFn: (newConfig) =>
      fetch("/api/l10n/config", {
        method: "PATCH",
        body: JSON.stringify(newConfig),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["l10n", "config"] })
    ,
  };
  return useMutation(query);
};

const useL10nConfigChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();
  const revalidator = useRevalidator();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent(event => {
      if (event.type === "L10nConfigChanged") {
        queryClient.invalidateQueries({ queryKey: ["l10n", "config"] });
        revalidator.revalidate();
      }
    });
  }, [queryClient, client, revalidator]);
};

export {
  configQuery,
  keymapsQuery,
  localesQuery,
  timezonesQuery,
  useConfigMutation,
  useL10nConfigChanges
};
