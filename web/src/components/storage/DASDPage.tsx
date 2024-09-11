/*
 * Copyright (c) [2023] SUSE LLC
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
import DASDTable from "~/components/storage/DASDTable";
import DASDFormatProgress from "~/components/storage/DASDFormatProgress";
import { _ } from "~/i18n";
import { Page } from "~/components/core";
import { useDASDDevicesChanges, useDASDFormatJobChanges } from "~/queries/dasd";
import { PATHS } from "~/routes/storage";

export default function DASDPage() {
  useDASDDevicesChanges();
  useDASDFormatJobChanges();

  return (
    <Page>
      <Page.Header>
        <h2>{_("DASD")}</h2>
      </Page.Header>

      <Page.MainContent>
        <DASDTable />
        <DASDFormatProgress />
      </Page.MainContent>
      <Page.NextActions>
        <Page.Action navigateTo={PATHS.targetDevice}>{_("Close")}</Page.Action>
      </Page.NextActions>
    </Page>
  );
}
