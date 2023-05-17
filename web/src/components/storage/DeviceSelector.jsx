/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { Icon } from "~/components/layout";
import { Popup } from "~/components/core";

const ListBox = ({ children, ...props }) => <ul role="listbox" {...props}>{children}</ul>;

const ListBoxItem = ({ isSelected, children, onClick }) => {
  console.log("option", children, "is selected?", isSelected);
  const props = {};
  if (isSelected) props['aria-selected'] = true;

  return (
    <li
      role="option"
      onClick={onClick}
      { ...props }
    >
      {children}
    </li>
  );
};

/**
 * Component for selecting a storage device
 * @component
 *
 */
export default function DeviceSelector ({ devices = ["Fake device", "Another fake device"] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState([]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = (element) => {
    setSelectedDevices([element]);
    // To allow multiple selection
    // const currentSelected = [...selectedDevices];
    // if (selectedDevices.includes(element)) {
    //   setSelectedDevices(currentSelected.filter(e => e !== element));
    // } else {
    //   setSelectedDevices([...currentSelected, element]);
    // }
  };

  return (
    <>
      <button onClick={open}>Open the device selector</button>
      <Popup title="Device Selector" isOpen={isOpen}>

        <ListBox aria-label="Available devices" className="stack device-selector">
          { devices.map(device => (
            <ListBoxItem
              key={device}
              onClick={() => toggle(device)}
              isSelected={selectedDevices.includes(device)}
            >
              <div>
                <Icon name="hard_drive" />
                <div>512 GiB</div>
              </div>
              <div>
                <div>/dev/vda</div>
                <div>Micron 1100 SATA</div>
              </div>
              <div>
                <div>Content</div>
                <div><Icon name="flex_wrap" size="14" /> GPT partition table</div>
                <div><Icon name="linux_logo" size="14" /> openSUSE Leap 15.2</div>
                <div><Icon name="windows_logo" size="14" /> Windows System</div>
              </div>
            </ListBoxItem>
          ))}
        </ListBox>

        <Popup.Actions>
          <Popup.Cancel onClick={close} />
        </Popup.Actions>
      </Popup>
    </>
  );
}
