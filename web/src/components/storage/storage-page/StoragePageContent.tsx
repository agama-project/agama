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

import React from "react";
import { Divider, PageSection, Stack } from "@patternfly/react-core";
import Page from "~/components/layout/Page";
import EntriesTable from "~/components/storage/entries-table/EntriesTable";
import TopLine, { TopResult } from "~/components/storage/storage-page/TopLine";
import { useElementSize } from "~/hooks/use-element-size";
import GlobalActions from "~/components/storage/storage-page/GlobalActions";
import Result from "~/components/storage/storage-page/Result";
import DeviceDetailsPanel from "~/components/storage/storage-page/DeviceDetailsPanel";
import { useDevicesBox } from "~/components/storage/storage-page/playground-switches";
import { useConfigModel } from "~/hooks/model/storage/config-model";

/**
 * What the storage page shows, and where everything it needs is read.
 *
 * The page has three states that replace it entirely, so they are picked before
 * anything else is arranged: no disk to install on, settings this interface
 * cannot read, and a configuration it knows nothing about.
 *
 * Everything else is the page: the top line, with the result and the settings
 * that apply to the whole installation, and then the devices it uses and the
 * controls that apply to all of them. The panel the page opens covers the
 * devices only, so the top line stays in sight while an entry is open.
 */
export default function StoragePageContent(): React.ReactNode {
  const model = useConfigModel();
  const box = useDevicesBox();
  const [resultNode, setResultNode] = React.useState<HTMLDivElement | null>(null);
  const { height: resultHeight = 0 } = useElementSize(resultNode);

  if (!model) return <Result />;

  const devices = (
    <DeviceDetailsPanel
      pinnedOffset={resultHeight}
      page={
        <Stack hasGutter>
          <EntriesTable />
          <Divider />
          <GlobalActions />
        </Stack>
      }
    />
  );

  return (
    <>
      <Result />
      {/* Kept in sight while the rest of the page scrolls: what every setting
          leads to. The same sticky section the software patterns page keeps
          its filter in. */}
      <PageSection
        component="div"
        stickyOnBreakpoint={{ default: "top" }}
        padding={{ default: "noPadding" }}
      >
        <div ref={setResultNode}>
          <TopResult />
        </div>
      </PageSection>
      <TopLine />
      {/* PLAYGROUND: the devices in a bordered box, or right on the page with
          a rule setting them apart from the top line. */}
      {box === "on" ? (
        <Page.Section>{devices}</Page.Section>
      ) : (
        <>
          <Divider />
          {devices}
        </>
      )}
    </>
  );
}
