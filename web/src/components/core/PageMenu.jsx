/*
 * Copyright (c) [2023-2024] SUSE LLC
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

// @ts-check

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
 * @typedef {object} TogglerBaseProps
 * @property {React.Ref<import('@patternfly/react-core').MenuToggleElement>} toggleRef
 * @property {string} label
 *
 * @typedef {TogglerBaseProps & import('@patternfly/react-core').MenuToggleProps} TogglerProps
 *
 * @param {TogglerProps} props
 */
const Toggler = ({ toggleRef, label, onClick, "aria-label": ariaLabel = _(("Show page menu")) }) => {
  return (
    <MenuToggle
      ref={toggleRef}
      onClick={onClick}
      aria-label={label || ariaLabel}
      variant="plain"
    >
      {label}
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
 * @see {PageMenu} examples.
 *
 * @param {import('@patternfly/react-core').DropdownGroupProps} props
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
 * @param {import('@patternfly/react-core').DropdownItemProps} props
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
 * @param {import('@patternfly/react-core').DropdownListProps} props
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
 * @typedef {object} PageMenuProps
 * @property {string} [togglerAriaLabel]
 * @property {string} label
 * @property {React.ReactNode} children
 *
 * @param {PageMenuProps} props
 */
const PageMenu = ({ togglerAriaLabel, label, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);
  const close = () => setIsOpen(false);

  return (
    <Dropdown
      isOpen={isOpen}
      toggle={(toggleRef) => <Toggler label={label} toggleRef={toggleRef} onClick={toggle} aria-label={togglerAriaLabel} />}
      onSelect={close}
      onOpenChange={close}
      popperProps={{ minWidth: "150px", position: "right" }}
      data-type="agama/page-menu"
    >
      <DropdownList>
        {children}
      </DropdownList>
    </Dropdown>
  );
};

PageMenu.Group = Group;
PageMenu.Options = Options;
PageMenu.Option = Option;

export default PageMenu;
