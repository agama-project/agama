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
import { Select, MenuToggle, MenuToggleElement, SelectProps } from "@patternfly/react-core";
import { TranslatedString } from "~/i18n";

export type SelectWrapperProps = {
  id?: string;
  value: number | string;
  label?: React.ReactNode;
  onChange?: (value: number | string) => void;
  isDisabled?: boolean;
  // Accessible name for the toggle
  toggleName?: TranslatedString;
} & Omit<SelectProps, "toggle" | "onChange">;

/**
 * Wrapper to simplify the usage of PF/Menu/Select
 *
 * Abstracts the toggle setup by building it internally based on the received props.
 *
 * @see https://www.patternfly.org/components/menus/select/
 */
export default function SelectWrapper({
  id,
  value,
  label,
  onChange,
  isDisabled = false,
  children,
  toggleName,
}: SelectWrapperProps): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);

  const onToggleClick = () => {
    setIsOpen(!isOpen);
  };

  const onSelect = (
    _: React.MouseEvent<Element, MouseEvent> | undefined,
    nextValue: string | number | undefined,
  ) => {
    setIsOpen(false);
    onChange && nextValue !== value && onChange(nextValue as string);
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => {
    return (
      <MenuToggle
        id={id}
        ref={toggleRef}
        onClick={onToggleClick}
        isExpanded={isOpen}
        isDisabled={isDisabled}
        {...(toggleName && { "aria-label": toggleName })}
      >
        {label || value}
      </MenuToggle>
    );
  };

  return (
    <Select
      isOpen={isOpen}
      selected={value}
      onSelect={onSelect}
      onOpenChange={(isOpen) => setIsOpen(isOpen)}
      toggle={toggle}
      shouldFocusToggleOnSelect
    >
      {children}
    </Select>
  );
}
