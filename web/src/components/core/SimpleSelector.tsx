/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useId, useState } from "react";
import {
  Flex,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  SelectProps,
} from "@patternfly/react-core";

import Text from "~/components/core/Text";

import type { TranslatedString } from "~/i18n";

type SimpleSelectorProps = {
  label: TranslatedString;
  value: string;
  options: Record<string, string>;
  onChange: SelectProps["onSelect"];
};

/**
 * Wrapper component for simplifying PF/Select usage for simple dropdowns.
 *
 * Renders a PF/Select input allowing users to choose one of the available
 * options. The selected value is passed to the parent via the `onChange`
 * callback along with the event originating the action.
 *
 * @privateRemarks
 * There is an issue with a11y label for the PF/MenuToggle, check
 * https://github.com/patternfly/patternfly-react/issues/11805
 */
export default function SimpleSelector({ label, value, options, onChange }: SimpleSelectorProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle id={id} ref={toggleRef} onClick={onToggle} isExpanded={isOpen}>
      {options[value]}
    </MenuToggle>
  );

  return (
    <Flex direction={{ default: "column" }} columnGap={{ default: "columnGapXs" }}>
      <label htmlFor={id}>
        <Text isBold aria-hidden>
          {label}
        </Text>
      </label>

      <Select
        isOpen={isOpen}
        selected={value}
        onSelect={(e, v) => {
          onChange(e, v);
          setIsOpen(false);
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
    </Flex>
  );
}
