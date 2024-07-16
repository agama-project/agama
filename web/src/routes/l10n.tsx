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
import { Page } from "~/components/core";
import { L10nPage, LocaleSelection, KeymapSelection, TimezoneSelection } from "~/components/l10n";
import { N_ } from "~/i18n";

const PATHS = {
  root: "/l10n",
  localeSelection: "/l10n/locale/select",
  keymapSelection: "/l10n/keymap/select",
  timezoneSelection: "/l10n/timezone/select",
};

const routes = () => ({
  path: PATHS.root,
  element: <Page />,
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
