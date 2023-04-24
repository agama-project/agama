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

import React, { useState } from 'react';
import { Button, Dropdown, DropdownItem, DropdownGroup } from '@patternfly/react-core';
import { Icon, ContextualActions as ContextualActionsSlot } from "~/components/layout";

/**
 * Internal component to build the {ContextualActions} toggler
 * @component
 *
 * @param {object} props
 * @param {function} props.onClick
 */
const Toggler = ({ onClick }) => {
  return (
    <Button onClick={onClick} variant="plain">
      <Icon name="expand_more" />
    </Button>
  );
};

/**
 * A group of actions belonging to a {ContextualActions} component
 * @component
 *
 * Built on top of {@link https://www.patternfly.org/v4/components/dropdown/#dropdowngroup PF DropdownGroup}
 *
 * @see {ContextualActions } examples.
 *
 * @param {object} props - PF DropdownItem props, See {@link https://www.patternfly.org/v4/components/dropdowngroup}
 */
const Group = ({ children, ...props }) => {
  return (
    <DropdownGroup {...props}>
      {children}
    </DropdownGroup>
  );
};

/**
 * An action belonging to a {ContextualActions} component
 * @component
 *
 * Built on top of {@link https://www.patternfly.org/v4/components/dropdown/#dropdownitem PF DropdownItem}
 *
 * @see {ContextualActions } examples.
 *
 * @param {object} props - PF DropdownItem props, See {@link https://www.patternfly.org/v4/components/dropdownitem}
 */
const Item = ({ children, ...props }) => {
  return (
    <DropdownItem {...props}>
      {children}
    </DropdownItem>
  );
};

/**
 * Component for rendering actions related to the current page
 * @component
 *
 * It consist in a {@link https://www.patternfly.org/v4/components/dropdown
 * PatternFly Dropdown} "teleported" to the header, close to the
 * action for opening the Sidebar
 *
 * @example <caption>Usage example</caption>
 *   <ContextualActions>
 *     <ContextualActions.Item
 *       key="reprobe-link"
 *       description="Run a storage device detection"
 *     >
 *
 *       Reprobe
 *     </ContextualActions.Item>
 *     <ContextualActions.Group key="configuration-links" label="Configure">
 *       <ContextualActions.Item
 *         key="dasd-link"
 *         href={href}
 *         description="Manage and format"
 *       >
 *         DASD
 *       </ContextualActions.Item>
 *       <ContextualActions.Item
 *         key="iscsi-link"
 *         href={href}
 *         description="Connect to iSCSI targets"
 *        >
 *         iSCSI
 *       </ContextualActions.Item>
 *     </ContextualActions.Group>
 *   </ContextualActions>
 *
 * @param {object} props
 * @param {Group|Item|Array<Group|Item>} props.children
 */
const ContextualActions = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);
  const onSelect = () => setIsOpen(false);

  return (
    <ContextualActionsSlot>
      <Dropdown
        isOpen={isOpen}
        toggle={<Toggler onClick={onToggle} />}
        onSelect={onSelect}
        dropdownItems={Array(children)}
        position="right"
        className="contextual-actions"
        isGrouped
      />
    </ContextualActionsSlot>
  );
};

ContextualActions.Group = Group;
ContextualActions.Item = Item;

export default ContextualActions;
