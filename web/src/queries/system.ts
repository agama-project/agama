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
import { tzOffset } from "@date-fns/tz/tzOffset";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { fetchSystem } from "~/api/api";
import { NetworkSystem } from "~/types/network";
import { System } from "~/types/system";

const transformLocales = (locales) =>
  locales.map(({ id, language: name, territory }) => ({ id, name, territory }));

const tranformKeymaps = (keymaps) => keymaps.map(({ id, description: name }) => ({ id, name }));

const transformTimezones = (timezones) =>
  timezones.map(({ id, parts, country }) => {
    const utcOffset = tzOffset(id, new Date());
    return { id, parts, country, utcOffset };
  });

/**
 * Returns a query for retrieving the localization configuration
 */
const systemQuery = () => {
  return {
    queryKey: ["system"],
    queryFn: fetchSystem,

    // FIXME: We previously had separate fetch functions (fetchLocales,
    // fetchKeymaps, fetchTimezones) that each applied specific transformations to
    // the raw API data, for example, adding `utcOffset` to timezones or
    // changing keys to follow a consistent structure (e.g. `id` vs `code`).
    //
    // Now that we've consolidated these into a single "system" cache, instead of
    // individual caches, those transformations are currently missing. While it's
    // more efficient to fetch everything in one request, we may still want to apply
    // those transformations only once. Ideally, this logic should live outside the
    // React Query layer, in a dedicated "state layer" or transformation step, so
    // that data remains normalized and consistently shaped for the rest of the app.

    select: (system: System) => ({
      ...system,
      l10n: {
        locales: transformLocales(system.l10n.locales),
        keymaps: tranformKeymaps(system.l10n.keymaps),
        timezones: transformTimezones(system.l10n.timezones),
        locale: system.l10n.locale,
        keypmap: system.l10n.keymap,
        timezone: system.l10n.timezone,
      },
    }),
  };
};

const useSystem = () => {
  const { data: system } = useSuspenseQuery(systemQuery());
  return system;
};

const useNetworkSystem = () => {
  const { data } = useSuspenseQuery({
    ...systemQuery(),
    select: (d) => NetworkSystem.fromApi(d.network),
  });

  return data;
};

const useNetworkDevices = () => {
  const { devices } = useNetworkSystem();

  return devices;
};

const useSystemChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "SystemChanged" && event.scope === "l10n") {
        queryClient.invalidateQueries({ queryKey: ["system"] });
      }
    });
  }, [client, queryClient]);
};

export { useSystem, useSystemChanges, useNetworkSystem, useNetworkDevices };
