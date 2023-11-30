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

const ListBox = ({ children, ...props }) => <ul data-type="agama/list" data-of="agama/space-policies" {...props}>{children}</ul>;

const ListBoxItem = ({ isSelected, children, onClick, ...props }) => {
  if (isSelected) props['aria-selected'] = true;

  return (
    <li
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
    let text;

    switch (policy) {
      case "delete":
        // TRANSLATORS: automatic actions to find space for installation in the target disk(s)
        text = _("Delete current content");
        break;
      case "resize":
        // TRANSLATORS: automatic actions to find space for installation in the target disk(s)
        text = _("Shrink existing partitions");
        break;
      case "keep":
        // TRANSLATORS: automatic actions to find space for installation in the target disk(s)
        text = _("Use available space");
        break;
    }

    return <div className="title">{text}</div>;
  };

  const Description = () => {
    let text;

    switch (policy) {
      case "delete":
        text = _("All partitions will be removed and any data in the disks will be lost.");
        break;
      case "resize":
        text = _("The data is kept, but the current partitions will be resized as needed to make enough space.");
        break;
      case "keep":
        text = _("The data is kept and existing partitions will not be modified. \
Only the space that is not assigned to any partition will be used.");
        break;
    }

    return <p>{text}</p>;
  };

  return (
    <>
      <Title />
      <Description />
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
    <ListBox aria-label={_("Select a mechanism to make space")} role="listbox">
      { ["delete", "resize", "keep"].map(policy => (
        <ListBoxItem
          key={policy}
          role="option"
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
          // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
          // would read as "Find space deleting all content[...]"
          n_(
            "deleting all content of the installation device",
            "deleting all content of the %d selected disks",
            num),
          num
        );
      case "resize":
        return sprintf(
          // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
          // would read as "Find space shrinking partitions[...]"
          n_(
            "shrinking partitions of the installation device",
            "shrinking partitions of the %d selected disks",
            num),
          num
        );
      case "keep":
        // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
        // would read as "Find space without modifying any partition".
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
        "This will only affect the installation device",
        "This will affect the %d disks selected for installation",
        num
      ),
      num
    );
  };

  const num = devices.length;

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
};

export { SpacePolicyButton, SpacePolicySelector, SpacePolicyDisksHint };
