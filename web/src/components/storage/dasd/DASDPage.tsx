/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { Page } from "~/components/core";
import DASDTable from "./DASDTable";
import DASDFormatProgress from "./DASDFormatProgress";
import { STORAGE as PATHS, STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

export default function DASDPage() {
  // FIXME: use the API v2 equivalent
  // useDASDDevicesChanges();
  // useDASDFormatJobChanges();

  return (
    <Page breadcrumbs={[{ label: _("Storage"), path: STORAGE.root }, { label: _("DASD") }]}>
      <Page.Content>
        <DASDTable />
        <DASDFormatProgress />
      </Page.Content>

      <Page.Actions>
        <Page.Action variant="secondary" navigateTo={PATHS.root}>
          {_("Back")}
        </Page.Action>
      </Page.Actions>
    </Page>
  );
}
