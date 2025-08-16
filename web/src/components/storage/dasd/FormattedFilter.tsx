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
import {
  Select,
  SelectList,
  MenuToggle,
  MenuToggleElement,
  SelectProps,
  SelectOption,
} from "@patternfly/react-core";
import { DASDDevicesFilters } from "~/components/storage/dasd/DASDTable";
import { _ } from "~/i18n";

type FormattedFilterProps = {
  value: DASDDevicesFilters["formatted"];
  onChange: SelectProps["onSelect"];
};

const options = {
  both: _("all"),
  yes: _("is formatted"),
  no: _("not formatted"),
};

export default function FormattedFilter({ value, onChange }: FormattedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle ref={toggleRef} onClick={onToggle} isExpanded={isOpen}>
      {options[value]}
    </MenuToggle>
  );

  return (
    <Select
      id="dasd-formatted"
      isOpen={isOpen}
      selected={value}
      onSelect={(e, v) => {
        onChange(e, v);
        onToggle();
      }}
      onOpenChange={(isOpen) => setIsOpen(isOpen)}
      toggle={toggle}
    >
      <SelectList>
        {Object.keys(options).map((key) => (
          <SelectOption key={key} value={key}>
            {options[key]}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
}
