/*
 * Copyright (c) [2025] SUSE LLC
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

import React, { ReactNode } from "react";
import {
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Flex,
} from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";

type ConfigEditorItemProps = React.PropsWithChildren<{
  /** Content to be rendered as "header" */
  header: ReactNode;
}>;

/**
 * Layout component for rendering an item in the storage/ConfigEditor data
 * list, consisting of a header, nested content, and an action area.
 *
 * NOTE: This component is intentionally not a static member of storage/ConfigEditor
 * (i.e., not used as ConfigEditor.Item) to avoid circular dependencies in components
 * that use ConfigEditor and are used by it (e.g., DriveEditor, VolumeGroupEditor).
 */
export default function ConfigEditorItem({ header, children }: ConfigEditorItemProps) {
  return (
    <DataListItem>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key="content">
              <Flex direction={{ default: "column" }} gap={{ default: "gapNone" }}>
                {header}
                <NestedContent>{children}</NestedContent>
              </Flex>
            </DataListCell>,
          ]}
        />
      </DataListItemRow>
    </DataListItem>
  );
}
