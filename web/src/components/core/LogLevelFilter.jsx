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

// labels for for all log levels (0..5)
const labels = [
  "Debug",
  "Info",
  "Warning",
  "Error",
  "Security",
  "Internal"
];

export default function LogLevelFilter({ levels, onChangeCallback }) {
  const [isOpen, setIsOpen] = useState(false);

  const onSelect = (index) => {
    const newLevels = [...levels];
    newLevels[index] = !newLevels[index];
    if (onChangeCallback) onChangeCallback(newLevels);
  };

  const onSelectAll = (allValue) => {
    const newLevels = levels.map(() => { return allValue });
    if (onChangeCallback) onChangeCallback(newLevels);
  };

  const menuItems = labels.map((label, index) => {
    return (
      <OptionsMenuItem
        onSelect={() => { onSelect(index) } }
        isSelected={levels[index]}
        key={`log-level-${index}`}
      >
        {`${index} - ${label}`}
      </OptionsMenuItem>
    );
  });

  // add All/None items
  menuItems.push(<OptionsMenuSeparator key="separator" />);
  menuItems.push(<OptionsMenuItem onSelect={() => { onSelectAll(true) } } key="all">All</OptionsMenuItem>);
  menuItems.push(<OptionsMenuItem onSelect={() => { onSelectAll(false) } } key="none">None</OptionsMenuItem>);

  const onToggle = () => {
    setIsOpen(!isOpen);
  };

  const toggle = <OptionsMenuToggleWithText toggleText="Log levels" toggleButtonContents={<CaretDownIcon />} onToggle={onToggle} />;

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
