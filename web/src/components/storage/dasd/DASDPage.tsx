/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { Content, Stack } from "@patternfly/react-core";
import { Page } from "~/components/core";
import DASDTable from "./DASDTable";
import DASDFormatProgress from "./DASDFormatProgress";
import { useDASDDevicesChanges, useDASDFormatJobChanges } from "~/queries/storage/dasd";
import { STORAGE as PATHS } from "~/routes/paths";
import { _ } from "~/i18n";

export default function DASDPage() {
  useDASDDevicesChanges();
  useDASDFormatJobChanges();

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("DASD")}</Content>
      </Page.Header>

      <Page.Content>
        {/** TRANSLATORS: DASD devices selection table */}
        <Page.Section aria-label={_("DASD devices selection table")}>
          <Stack>
            <DASDTable />
          </Stack>
        </Page.Section>
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
