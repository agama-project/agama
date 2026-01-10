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

import React, { useState } from "react";
import { Content } from "@patternfly/react-core";
import { SelectableDataTable, Page } from "~/components/core/";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import { SelectableDataTableProps } from "../core/SelectableDataTable";
import {
  typeDescription,
  contentDescription,
  filesystemLabels,
} from "~/components/storage/utils/device";
import type { Storage } from "~/model/system";

type DeviceSelectorProps = {
  devices: Storage.Device[];
  selectedDevices?: Storage.Device[];
  onSelectionChange: SelectableDataTableProps["onSelectionChange"];
  selectionMode?: SelectableDataTableProps["selectionMode"];
};

const DeviceSelector = ({
  devices,
  selectedDevices,
  onSelectionChange,
  selectionMode = "single",
}: DeviceSelectorProps) => {
  return (
    <>
      <SelectableDataTable
        columns={[
          { name: _("Type"), value: typeDescription, pfThProps: { width: 10 } },
          { name: _("Name"), value: (device: Storage.Device) => device.name },
          { name: _("Content"), value: contentDescription },
          { name: _("Filesystems"), value: filesystemLabels },
        ]}
        items={devices}
        itemIdKey="sid"
        itemsSelected={selectedDevices}
        onSelectionChange={onSelectionChange}
        selectionMode={selectionMode}
      />
    </>
  );
};

export default function DeviceSelectorPage(): React.ReactNode {
  const devices = useAvailableDevices();
  const [selectedDevices, setSelectedDevices] = useState([]);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Device Selection")}</Content>
      </Page.Header>
      <Page.Content>
        <Content>
          {_(
            "The modal selector offers a simplified interface designed for quick and straightforward use, without overwhelming the user.",
          )}
        </Content>
        <Content>
          {_(
            "For more advanced needs, users can switch to this full-page, dedicated path version that provides more space for detailed views, additional columns, filters, and extended functionality.",
          )}
        </Content>
        <Content>
          {_(
            "This pattern strikes a balance between clarity and efficiency: the modal keeps things lightweight for simple selections, while the full view supports deeper exploration and more complex actions, specially for users with tons of devices.",
          )}
        </Content>
        <DeviceSelector
          devices={devices}
          selectedDevices={selectedDevices}
          onSelectionChange={setSelectedDevices}
          selectionMode="multiple"
        />
      </Page.Content>
    </Page>
  );
}
