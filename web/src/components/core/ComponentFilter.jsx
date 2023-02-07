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

export default function ComponentFilter({ components, onChangeCallback }) {
  const [isOpen, setIsOpen] = useState(false);

  const onSelect = (index) => {
    const newComponents = { ...components };
    newComponents[index] = !newComponents[index];
    if (onChangeCallback) onChangeCallback(newComponents);
  };

  const onToggle = () => {
    setIsOpen(!isOpen);
  };

  const onSelectAll = (allValue) => {
    const newComponents = {};
    Object.keys(components).forEach((index) => { newComponents[index] = allValue });
    if (onChangeCallback) onChangeCallback(newComponents);
  };

  // sort the component names alphabetically (depending on the current locale)
  const names = Object.keys(components)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const menuItems = names.map((label) => {
    return (
      <OptionsMenuItem
        onSelect={() => { onSelect(label) } }
        isSelected={components[label]}
        key={`log-cpt-${label}`}
      >
        {label}
      </OptionsMenuItem>
    );
  });

  // add All/None items
  menuItems.push(<OptionsMenuSeparator key="separator" />);
  menuItems.push(<OptionsMenuItem onSelect={() => { onSelectAll(true) } } key="all">All</OptionsMenuItem>);
  menuItems.push(<OptionsMenuItem onSelect={() => { onSelectAll(false) } } key="none">None</OptionsMenuItem>);

  const toggle = (
    <OptionsMenuToggleWithText
    toggleText="Components"
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
