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

import React, { useState } from "react";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { deviceChildren } from "~/components/storage/utils";
import { ControlledPanels as Panels, Popup } from "~/components/core";
import { DeviceSelectorTable } from "~/components/storage";

const SELECT_DISK_ID = "select-disk";
const CREATE_LVM_ID = "create-lvm";
const SELECT_DISK_PANEL_ID = "panel-for-disk-selection";
const CREATE_LVM_PANEL_ID = "panel-for-lvm-creation";
const OPTIONS_NAME = "selection-mode";

const baseDescription = _("All the file systems will be created as <b>%s</b> \
  by default, although the location of each file system can be customized later \
  if needed.");

const Html = ({ children, ...props }) => (
  <div {...props} dangerouslySetInnerHTML={{ __html: children }} />
);

/**
 * TODO: Write a good component description.
 *
 * Renders a dialog that allows user select a device
 * @component
 *
 * @param {object} props
 * @param {object[]} [props.devices=[]] - The actions to perform in the system.
 * @param {boolean} [props.isOpen=false] - Whether the dialog is visible or not.
 * @param {function} props.onClose - Callback to execute when user closes the dialog
 * @param {function} props.onConfirm - Callback to execute when user closes the dialog
 */
export default function DeviceSelectionDialog({ devices = [], isOpen = true, onClose, onConfirm, ...props }) {
  const [mode, setMode] = useState(SELECT_DISK_ID);
  const [disks, setDisks] = useState([]);
  const [vgDevices, setVgDevices] = useState([]);

  const onConfirmation = () => {
    let settings;

    switch (mode) {
      case SELECT_DISK_ID:
        settings = { lvm: false, vgDevices };
        break;
      case CREATE_LVM_ID:
        settings = { lvm: true, vgDevices };
        break;
    }

    console.log("Data to sent", settings);
    console.log("Calling onConfirm", onConfirm);

    typeof onConfirm === "function" && onConfirm(settings);
  };

  const onCancel = (data) => console.log("accept data", data);

  const selectDiskMode = mode === SELECT_DISK_ID;
  const createVgMode = mode === CREATE_LVM_ID;

  return (
    <Popup
      title={_("Device for installing the system")}
      isOpen={isOpen}
      variant="large"
      {...props}
      style={{ minBlockSize: "70dvh" }}
    >
      <Panels className="stack">
        <Panels.Options data-variant="buttons">
          <Panels.Option
            id={SELECT_DISK_ID}
            name={OPTIONS_NAME}
            isSelected={selectDiskMode}
            onChange={() => setMode(SELECT_DISK_ID)}
            controls={SELECT_DISK_PANEL_ID}
          >
            {_("Select a disk")}
          </Panels.Option>
          <Panels.Option
            id={CREATE_LVM_ID}
            name={OPTIONS_NAME}
            isSelected={createVgMode}
            onChange={() => setMode(CREATE_LVM_ID)}
            controls={CREATE_LVM_PANEL_ID}
          >
            {_("Create a LVM Volume Group")}
          </Panels.Option>
        </Panels.Options>

        <Panels.Panel id={SELECT_DISK_PANEL_ID} isExpanded={selectDiskMode}>
          <Html>
            { sprintf(baseDescription, _("partitions in the selected device")) }
          </Html>

          <DeviceSelectorTable
            devices={devices}
            selected={disks}
            itemChildren={d => deviceChildren(d)}
            itemSelectable={d => d.type === "disk" }
            onSelectionChange={setDisks}
            variant="compact"
          />
        </Panels.Panel>

        <Panels.Panel id={CREATE_LVM_PANEL_ID} isExpanded={createVgMode} className="stack">
          <Html>
            { sprintf(baseDescription, _("logical volumes of a new LVM Volume Group")) }
          </Html>

          <div>
            {_("The Physical Volumes for the new Volume Group will be allocated in the selected devices.")}
          </div>

          <DeviceSelectorTable
            isMultiple
            devices={devices}
            selected={vgDevices}
            itemChildren={d => deviceChildren(d)}
            itemSelectable={d => d.isDrive }
            onSelectionChange={setVgDevices}
            variant="compact"
          />
        </Panels.Panel>
      </Panels>

      <Popup.Actions>
        <Popup.Confirm onClick={onConfirmation} />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
