/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useState } from "react";
import { Divider, PageSection, Stack } from "@patternfly/react-core";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import EntriesTable from "~/components/storage/entries-table/EntriesTable";
import TopLine, { TopResult } from "~/components/storage/storage-page/TopLine";
import { useElementSize } from "~/hooks/use-element-size";
import GlobalActions from "~/components/storage/storage-page/GlobalActions";
import StorageEmptyState from "~/components/storage/storage-page/StorageEmptyState";
import useAnnounceResult from "~/components/storage/storage-page/use-announce-result";
import { usePageState } from "~/components/storage/storage-page/use-page-state";
import DeviceDetailsPanel from "~/components/storage/storage-page/DeviceDetailsPanel";

/**
 * The content of the storage page.
 *
 * Some states replace the whole page: no disk to install on, a configuration
 * with issues that cannot be fixed here, and one this interface cannot
 * represent.
 *
 * Otherwise, the result stays in view at the top while the rest scrolls: the
 * installation settings, the devices and the actions on all of them. The
 * device panel opens below the result.
 */
export default function StoragePageContent(): React.ReactNode {
  const [resultNode, setResultNode] = useState<HTMLDivElement | null>(null);
  const { height: resultHeight = 0 } = useElementSize(resultNode);
  const state = usePageState();
  useAnnounceResult();

  if (state.kind !== "page") return <StorageEmptyState state={state} />;

  const devices = (
    <DeviceDetailsPanel
      pinnedOffset={resultHeight}
      page={
        <Stack hasGutter>
          <TopLine />
          <Divider />
          <EntriesTable />
          <GlobalActions />
        </Stack>
      }
    />
  );

  return (
    <>
      <PageSection
        component="div"
        stickyOnBreakpoint={{ default: "top" }}
        padding={{ default: "noPadding" }}
      >
        <div ref={setResultNode}>
          {/* Measured with its bottom room, so the panel starts below it. */}
          <div className={spacingStyles.pbMd}>
            <TopResult />
          </div>
        </div>
      </PageSection>
      {devices}
    </>
  );
}
