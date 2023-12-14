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
import {
  Dropdown, DropdownGroup, DropdownItem, DropdownList,
  MenuToggle
} from '@patternfly/react-core';
import { _ } from "~/i18n";
import { Icon } from "~/components/layout";

/**
 * Internal component to build the {PageOptions} toggler
 * @component
 *
 * @param {object} props
 * @param {function} props.onClick
 */
const Toggler = ({ toggleRef, onClick }) => {
  return (
    <MenuToggle
      ref={toggleRef}
      onClick={onClick}
      aria-label={_("Show page options")}
      variant="plain"
      className="plain-button"
    >
      <Icon name="expand_more" />
    </MenuToggle>
  );
};

/**
 * A group of actions belonging to a {PageOptions} component
 * @component
 *
 * Built on top of {@link https://www.patternfly.org/components/menus/dropdown#dropdowngroup PF/DropdownGroup}
 *
 * @see {PageOptions } examples.
 *
 * @param {object} props - PF/DropdownGroup props, See {@link https://www.patternfly.org/components/menus/dropdown#dropdowngroup}
 */
const Group = ({ children, ...props }) => {
  return (
    <DropdownGroup {...props}>
      {children}
    </DropdownGroup>
  );
};

/**
 * An option belonging to a {PageOptions} component
 * @component
 *
 * Built on top of {@link https://www.patternfly.org/components/menus/dropdown#dropdownitem PF/DropdownItem}
 *
 * @see {PageOptions } examples.
 *
 * @param {object} props - PF/DropdownItem props, See {@link https://www.patternfly.org/components/menus/dropdown#dropdownitem}
 */
const Option = ({ children, ...props }) => {
  return (
    <DropdownItem {...props}>
      {children}
    </DropdownItem>
  );
};

/**
 * A collection of {Option}s belonging to a {PageOptions} component
 * @component
 *
 * Built on top of {@link https://www.patternfly.org/components/menus/dropdown#dropdownlist PF/DropdownList}
 *
 * @see {PageOptions} examples.
 *
 * @param {object} props - PF/DropdownList props, See {@link https://www.patternfly.org/components/menus/dropdown#dropdownlist}
 */
const Options = ({ children, ...props }) => {
  return (
    <DropdownList {...props}>
      {children}
    </DropdownList>
  );
};

/**
 * Component for rendering actions related to the current page
 * @component
 *
 * It consist in a {@link https://www.patternfly.org/components/menus/dropdown PF/Dropdown}
 * "teleported" to the header, close to the action for opening the Sidebar
 *
 * @example <caption>Usage example</caption>
 *   <PageOptions>
 *     <PageOptions.Options>
 *       <PageOptions.Option
 *         key="reprobe-link"
 *         description="Run a storage device detection"
 *       >
 *
 *         Reprobe
 *       </PageOptions.Option>
 *     </PageOptions.Options>
 *     <PageOptions.Group key="configuration-links" label="Configure">
 *       <PageOptions.Options>
 *         <PageOptions.Option
 *           key="dasd-link"
 *           to={href}
 *           description="Manage and format"
 *         >
 *           DASD
 *         </PageOptions.Option>
 *         <PageOptions.Option
 *           key="iscsi-link"
 *           to={href}
 *           description="Connect to iSCSI targets"
 *          >
 *           iSCSI
 *         </PageOptions.Option>
 *       <PageOptions.Options>
 *     </PageOptions.Group>
 *   </PageOptions>
 *
 * @param {object} props
 * @param {Group|Item|Array<Group|Item>} props.children
 */
const PageOptions = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);
  const close = () => setIsOpen(false);

  return (
    <Dropdown
      isOpen={isOpen}
      toggle={(toggleRef) => <Toggler toggleRef={toggleRef} onClick={toggle} />}
      onSelect={close}
      onOpenChange={close}
      popperProps={{ minWidth: "150px", position: "right" }}
      className="page-options"
    >
      <DropdownList>
        {Array(children)}
      </DropdownList>
    </Dropdown>
  );
};

PageOptions.Group = Group;
PageOptions.Options = Options;
PageOptions.Option = Option;

export default PageOptions;
