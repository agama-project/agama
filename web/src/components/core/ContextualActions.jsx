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

const Toggler = ({ onClick }) => {
  return (
    <Button onClick={onClick} variant="plain">
      <Icon name="expand_more" />
    </Button>
  );
};

const Group = ({ children, ...props }) => {
  return (
    <DropdownGroup {...props}>
      {children}
    </DropdownGroup>
  );
};

const Item = ({ children, ...props }) => {
  return (
    <DropdownItem {...props}>
      {children}
    </DropdownItem>
  );
};

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
