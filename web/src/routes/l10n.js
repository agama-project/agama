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
import { queryClient } from "~/context/app";
import {
  configQuery,
  localesQuery,
  keymapsQuery,
  timezonesQuery,
} from "~/queries/l10n";
import { N_ } from "~/i18n";

const L10N_PATH = "/l10n";
const LOCALE_SELECTION_PATH = "locale/select";
const KEYMAP_SELECTION_PATH = "keymap/select";
const TIMEZONE_SELECTION_PATH = "timezone/select";

const routes = {
  path: L10N_PATH,
  element: <Page />,
  handle: {
    name: N_("Localization"),
    icon: "globe"
  },
  children: [
    {
      index: true,
      element: <L10nPage />
    },
    {
      path: LOCALE_SELECTION_PATH,
      element: <LocaleSelection />,
    },
    {
      path: KEYMAP_SELECTION_PATH,
      element: <KeymapSelection />,
    },
    {
      path: TIMEZONE_SELECTION_PATH,
      element: <TimezoneSelection />,
    }
  ]
};

export default routes;
export {
  L10N_PATH,
  LOCALE_SELECTION_PATH,
  KEYMAP_SELECTION_PATH,
  TIMEZONE_SELECTION_PATH
};
