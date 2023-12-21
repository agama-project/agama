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
 * Internal component to build the {PageMenu} toggler
 * @component
 *
 * @param {object} props
 * @param {string} [props.aria-label="Show page menu"]
 * @param {function} props.onClick
 */
const Toggler = ({ toggleRef, onClick, "aria-label": ariaLabel = _(("Show page menu")) }) => {
  return (
    <MenuToggle
      ref={toggleRef}
      onClick={onClick}
      aria-label={ariaLabel}
      variant="plain"
    >
      <Icon name="expand_more" />
    </MenuToggle>
  );
};

/**
 * A group of actions belonging to a {PageMenu} component
 * @component
 *
 * Built on top of {@link https://www.patternfly.org/components/menus/dropdown#dropdowngroup PF/DropdownGroup}
 *
 * @see {PageMenu } examples.
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
 * An option belonging to a {PageMenu} component
 * @component
 *
 * Built on top of {@link https://www.patternfly.org/components/menus/dropdown#dropdownitem PF/DropdownItem}
 *
 * @see {PageMenu} examples.
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
 * A collection of {Option}s belonging to a {PageMenu} component
 * @component
 *
 * Built on top of {@link https://www.patternfly.org/components/menus/dropdown#dropdownlist PF/DropdownList}
 *
 * @see {PageMenu} examples.
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
 * Component for rendering actions related to a page.
 * @component
 *
 * It consist in a {@link https://www.patternfly.org/components/menus/dropdown PF/Dropdown}
 * rendered in the header close to the action for opening the Sidebar.
 *
 * @note when wrapping it in another component intended to hold all the needed
 * logic for building the page menu, it's name must includes the "PageMenu" suffix.
 * This is needed to allow core/Page properly work with it. See core/Page component
 * for a better understanding.
 *
 * @see core/Page component.
 *
 * @example <caption>Usage example</caption>
 *   <PageMenu>
 *     <PageMenu.Options>
 *       <PageMenu.Option
 *         key="reprobe-link"
 *         description="Run a storage device detection"
 *       >
 *
 *         Reprobe
 *       </PageMenu.Option>
 *     </PageMenu.Options>
 *     <PageMenu.Group key="configuration-links" label="Configure">
 *       <PageMenu.Options>
 *         <PageMenu.Option
 *           key="dasd-link"
 *           to={href}
 *           description="Manage and format"
 *         >
 *           DASD
 *         </PageMenu.Option>
 *         <PageMenu.Option
 *           key="iscsi-link"
 *           to={href}
 *           description="Connect to iSCSI targets"
 *          >
 *           iSCSI
 *         </PageMenu.Option>
 *       <PageMenu.Options>
 *     </PageMenu.Group>
 *   </PageMenu>
 *
 * @param {object} props
 * @param {Group|Item|Array<Group|Item>} props.children
 */
const PageMenu = ({ togglerAriaLabel, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);
  const close = () => setIsOpen(false);

  return (
    <Dropdown
      isOpen={isOpen}
      toggle={(toggleRef) => <Toggler toggleRef={toggleRef} onClick={toggle} aria-label={togglerAriaLabel} />}
      onSelect={close}
      onOpenChange={close}
      popperProps={{ minWidth: "150px", position: "right" }}
      data-type="agama/page-menu"
    >
      <DropdownList>
        {Array(children)}
      </DropdownList>
    </Dropdown>
  );
};

PageMenu.Group = Group;
PageMenu.Options = Options;
PageMenu.Option = Option;

export default PageMenu;
