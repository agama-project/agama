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

import React, { useState } from "react";

import { _, n_ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { noop } from "~/utils";
import { Button, ExpandableSection, Hint, HintBody } from "@patternfly/react-core";
import { DeviceList } from "~/components/storage";

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
  const Title = () => {
    switch (policy) {
      case "delete":
        return _("Delete current content");
      case "resize":
        return _("Shrink existing partitions");
      case "keep":
        return _("Use available space");
    }
  };

  const Description = () => {
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
      <div className="bold"><Title /></div>
      <div data-type="details"><Description /></div>
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

const SpacePolicyButton = ({ policy, devices, onClick = noop }) => {
  const Text = () => {
    const num = devices.length;

    switch (policy) {
      case "delete":
        return sprintf(
          n_("deleting all content at the target disk", "deleting all content at the %d chosen disks", num),
          num
        );
      case "resize":
        return sprintf(
          n_(
            "shrinking partitions at the target disk",
            "shrinking partitions at the %d chosen disks",
            num),
          num
        );
      case "keep":
        return _("without modifying any partition");
    }
    console.log("Unsupported value " + policy);
    return "error";
  };

  return <Button variant="link" isInline onClick={onClick}><Text /></Button>;
};

const SpacePolicyDisksHint = ({ devices }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const label = (num) => {
    return sprintf(
      n_(
        "This will only affect the target installation disk",
        "This will affect the %d devices chosen for installation",
        num
      ),
      num
    );
  };

  const num = devices.length;
  if (num > 1) {
    return (
      <Hint>
        <HintBody>
          <ExpandableSection
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            toggleText={label(num)}
          >
            <DeviceList devices={devices} />
          </ExpandableSection>
        </HintBody>
      </Hint>
    );
  } else {
    return (
      <Hint>
        <HintBody>{label(num)}</HintBody>
      </Hint>
    );
  }
};

export { SpacePolicyButton, SpacePolicySelector, SpacePolicyDisksHint };
