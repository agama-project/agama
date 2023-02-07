/*
 * Copyright (c) [2022] SUSE LLC
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
import { OptionsMenu, OptionsMenuDirection, OptionsMenuItem, OptionsMenuToggleWithText, OptionsMenuSeparator } from "@patternfly/react-core";
import { CaretDownIcon } from "@patternfly/react-icons/dist/esm/icons/caret-down-icon";

// labels for each log part
const labels = {
  date: "Date",
  time: "Time",
  level: "Log level",
  host: "Host name",
  pid: "Process ID",
  component: "Component",
  location: "Location",
  message: "Message"
};

export default function PropertyFilter({ properties, onChangeCallback }) {
  const [isOpen, setIsOpen] = useState(false);

  const onSelect = (index) => {
    const newProperties = { ...properties };
    newProperties[index] = !newProperties[index];
    if (onChangeCallback) onChangeCallback(newProperties);
  };

  const onToggle = () => {
    setIsOpen(!isOpen);
  };

  const onSelectAll = (allValue) => {
    const newProperties = {};
    Object.keys(properties).forEach((key) => { newProperties[key] = allValue });
    if (onChangeCallback) onChangeCallback(newProperties);
  };

  const menuItems = [];

  for (const [key, label] of Object.entries(labels)) {
    menuItems.push(
      <OptionsMenuItem
        onSelect={() => { onSelect(key) } }
        isSelected={properties[key]}
        key={`log-attr-${key}`}
      >
        {label}
      </OptionsMenuItem>
    );
  }

  // add All/None items
  menuItems.push(<OptionsMenuSeparator key="separator" />);
  menuItems.push(<OptionsMenuItem onSelect={() => { onSelectAll(true) } } key="all">All</OptionsMenuItem>);
  menuItems.push(<OptionsMenuItem onSelect={() => { onSelectAll(false) } } key="none">None</OptionsMenuItem>);

  const toggle = (
    <OptionsMenuToggleWithText
    toggleText="Log properties"
    toggleButtonContents={<CaretDownIcon />}
    onToggle={onToggle}
    />
  );

  return (
    <OptionsMenu
      direction={OptionsMenuDirection.up}
      menuItems={menuItems}
      isOpen={isOpen}
      isText
      toggle={toggle}
    />
  );
}
