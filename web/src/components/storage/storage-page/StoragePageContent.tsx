/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { Grid } from "@patternfly/react-core";
import EntriesTable from "~/components/storage/entries-table/EntriesTable";
import TopLine from "~/components/storage/storage-page/TopLine";
import BottomLine from "~/components/storage/storage-page/BottomLine";
import Result from "~/components/storage/storage-page/Result";
import StorageSheet from "~/components/storage/storage-page/StorageSheet";
import SummaryLayout from "~/components/storage/storage-page/SummaryLayout";
import { useConfigModel } from "~/hooks/model/storage/config-model";

/**
 * What the storage page shows, and where everything it needs is read.
 *
 * The page has three states that replace it entirely, so they are picked before
 * anything else is arranged: no disk to install on, settings this interface
 * cannot read, and a configuration it knows nothing about.
 *
 * Everything else is the page, with the sheet the page opens over it. The sheet
 * wraps rather than sits beside, because two of its three placements are about
 * what the page does while it is open.
 */
export default function StoragePageContent(): React.ReactNode {
  const model = useConfigModel();

  const body = (
    <Grid hasGutter>
      {model && <TopLine />}
      <SummaryLayout notice={<Result />} />
      {model && <EntriesTable />}
      {model && <BottomLine />}
    </Grid>
  );

  return <StorageSheet page={body} />;
}
