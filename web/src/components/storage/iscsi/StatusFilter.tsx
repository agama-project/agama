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

import React, { useState } from "react";
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
import { _ } from "~/i18n";

type StatusFilterProps = {
  value: string;
  options: { [key: string]: string };
  onChange: SelectProps["onSelect"];
};

const ID = "iscsi-status-filter";

/** Select component for filtering iSCSI targets by status.
 *
 * Renders a PF/Select input allowing users to choose one of the available
 * statuses. The selected value is passed to the parent via the `onChange`
 * callback along with the event originating the action.
 *
 * Used as part of the iSCSI targets table filtering toolbar.
 *
 * @privateRemarks There is an issue with a11y label for the PF/MenuToggle,
 * check https://github.com/patternfly/patternfly-react/issues/11805
 */
export default function StatusFilter({ value = "all", options, onChange }: StatusFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);
  const opts = { all: _("All"), ...options };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      id={ID}
      ref={toggleRef}
      onClick={onToggle}
      isExpanded={isOpen}
      aria-label={_("Status filter toggle")}
    >
      {/* eslint-disable agama-i18n/string-literals */}
      {_(opts[value])}
    </MenuToggle>
  );

  return (
    <Flex direction={{ default: "column" }} columnGap={{ default: "columnGapXs" }}>
      <label htmlFor={ID}>
        <Text isBold aria-hidden>
          {_("Status")}
        </Text>
      </label>

      <Select
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
          {Object.keys(opts).map((key) => (
            <SelectOption key={key} value={key}>
              {/* eslint-disable agama-i18n/string-literals */}
              {_(opts[key])}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </Flex>
  );
}
