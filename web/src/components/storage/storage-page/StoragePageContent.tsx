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
import { Divider, Stack } from "@patternfly/react-core";
import Page from "~/components/layout/Page";
import EntriesTable from "~/components/storage/entries-table/EntriesTable";
import TopLine from "~/components/storage/storage-page/TopLine";
import GlobalActions from "~/components/storage/storage-page/GlobalActions";
import Result from "~/components/storage/storage-page/Result";
import StorageSheet from "~/components/storage/storage-page/StorageSheet";
import { useConfigModel } from "~/hooks/model/storage/config-model";

/**
 * What the storage page shows, and where everything it needs is read.
 *
 * The page has three states that replace it entirely, so they are picked before
 * anything else is arranged: no disk to install on, settings this interface
 * cannot read, and a configuration it knows nothing about.
 *
 * Everything else is the page, laid out as other pages are: what the
 * configuration will do first, then the page description next to the settings
 * that apply to the whole installation, and then a box holding the devices it
 * uses and the controls that apply to all of them.
 *
 * The sheet the page opens is laid over it. The sheet wraps rather than sits
 * beside, because two of its three placements are about what the page does
 * while it is open.
 *
 * What the configuration will do stays above the sheet, never under it. A
 * change made in the sheet can turn that report from a plan into a problem or
 * back, and the reader has to be able to see it and act on it without closing
 * the sheet first.
 */
export default function StoragePageContent(): React.ReactNode {
  const model = useConfigModel();

  const body = (
    <Stack hasGutter>
      {model && <TopLine />}
      {model && (
        <Page.Section>
          <Stack hasGutter>
            <EntriesTable />
            <Divider />
            <GlobalActions />
          </Stack>
        </Page.Section>
      )}
    </Stack>
  );

  return (
    <>
      <Result />
      <StorageSheet page={body} />
    </>
  );
}
