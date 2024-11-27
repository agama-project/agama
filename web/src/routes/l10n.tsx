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

import React from "react";
import { L10nPage, LocaleSelection, KeymapSelection, TimezoneSelection } from "~/components/l10n";
import { Route } from "~/types/routes";
import { L10N as PATHS } from "~/routes/paths";
import { N_ } from "~/i18n";

const routes = (): Route => ({
  path: PATHS.root,
  handle: {
    name: N_("Localization"),
    icon: "globe",
  },
  children: [
    {
      index: true,
      element: <L10nPage />,
    },
    {
      path: PATHS.localeSelection,
      element: <LocaleSelection />,
    },
    {
      path: PATHS.keymapSelection,
      element: <KeymapSelection />,
    },
    {
      path: PATHS.timezoneSelection,
      element: <TimezoneSelection />,
    },
  ],
});

export default routes;
export { PATHS };
