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

import React from "react";
import {
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
} from "@patternfly/react-core";

export type SelectToggleOption = {
  value: string;
  label: string;
  description?: string;
};

export type SelectToggleProps = {
  value?: string;
  options: SelectToggleOption[];
  onChange?: (value: string) => void;
  isDisabled?: boolean;
};

export default function SelectToggle({
  value,
  options,
  onChange,
  isDisabled,
}: SelectToggleProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string>(value || options[0].value);

  const onToggleClick = () => {
    setIsOpen(!isOpen);
  };

  const onSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ) => {
    setSelected(value as string);
    setIsOpen(false);
    onChange && onChange(value as string);
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => {
    const option = options.find((o) => o.value === selected);

    return (
      <MenuToggle
        ref={toggleRef}
        onClick={onToggleClick}
        isExpanded={isOpen}
        isDisabled={isDisabled}
      >
        {option.label}
      </MenuToggle>
    );
  };

  return (
    <Select
      id="option-variations-select"
      isOpen={isOpen}
      selected={selected}
      onSelect={onSelect}
      onOpenChange={(isOpen) => setIsOpen(isOpen)}
      toggle={toggle}
      shouldFocusToggleOnSelect
    >
      <SelectList>
        {options.map((option, index) => {
          return (
            <SelectOption key={index} value={option.value} description={option.description}>
              {option.label}
            </SelectOption>
          );
        })}
      </SelectList>
    </Select>
  );
}
