/*
 * Copyright (c) [2023] SUSE LLC
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

import React from "react";

import { _ } from "~/i18n";
import { noop } from "~/utils";
import { Button } from "@patternfly/react-core";

const ListBox = ({ children, ...props }) => <ul role="listbox" {...props}>{children}</ul>;

const ListBoxItem = ({ isSelected, children, onClick, ...props }) => {
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
 * Content for a space policy item
 * @component
 *
 * @param {Object} props
 * @param {Locale} props.locale
 */
const PolicyItem = ({ policy }) => {
  const title = (policy) => {
    switch (policy) {
      case "delete":
        return _("Delete current content");
      case "resize":
        return _("Shrink existing partitions");
      case "keep":
        return _("Use available space");
    }
  };

  const description = (policy) => {
    switch (policy) {
      case "delete":
        return _("All partitions will be removed and any data in the disks will be lost.");
      case "resize":
        return _("The data is kept, but the current partitions will be resized as needed to make enough space.");
      case "keep":
        return _("The data is kept and existing partitions will not be modified. Only the currently unpartitioned space will be used.");
    }
  };

  return (
    <>
      <div>{title(policy)}</div>
      <div {...{ "data-type": "details" }}>{description(policy)}</div>
    </>
  );
};

/**
 * Component for selecting a policy to make space.
 * @component
 *
 * @param {Object} props
 * @param {string} [props.value] - Id of the currently selected policy.
 * @param {(id: string) => void} [props.onChange] - Callback to be called when the selected policy
 *  changes.
 */
const SpacePolicySelector = ({ value, onChange = noop }) => {
  return (
    <ListBox aria-label={_("Select a mechanism to make space")} className="stack item-list">
      { ["delete", "resize", "keep"].map(policy => (
        <ListBoxItem
          key={policy}
          onClick={() => onChange(policy)}
          isSelected={policy === value}
          className="cursor-pointer"
        >
          <PolicyItem policy={policy} />
        </ListBoxItem>
      ))}
    </ListBox>
  );
};

const SpacePolicyButton = ({ policy, onClick = noop }) => {
  const text = (policy) => {
    switch (policy) {
      case "delete":
        return _("deleting its current content");
      case "resize":
        return _("shrinking existing partitions");
      case "keep":
        return _("without modifying any partition");
    }
    console.log("Unsupported value " + policy);
    return "error";
  };

  return <Button variant="link" isInline onClick={onClick}>{text(policy)}</Button>;
};

export { SpacePolicyButton, SpacePolicySelector };
