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

import { tzOffset } from "@date-fns/tz/tzOffset";
import { useSuspenseQuery } from "@tanstack/react-query";
import { fetchSystem } from "~/api/api";

const tranformKeymaps = (keymaps) => keymaps.map(({ id, description: name }) => ({ id, name }));

const transformTimezones = (timezones) =>
  timezones.map(({ code: id, parts, country }) => {
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

    select: (data) => ({
      ...data,
      // FIXME: NEW-API: ask for l10n key instead.
      locale: {
        ...data.locale,
        keymaps: tranformKeymaps(data.locale.keymaps),
        timezones: transformTimezones(data.locale.timezones),
      },
    }),
  };
};

const useSystem = () => {
  const { data: config } = useSuspenseQuery(systemQuery());
  return config;
};

export { useSystem };
