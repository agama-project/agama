/*
 * Copyright (c) [2025] SUSE LLC
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

// @ts-check

import React, { useId, useRef, useState } from "react";
import { Icon } from "../../layout";
import {
  Menu,
  MenuContainer,
  MenuContent,
  MenuToggle,
  MenuToggleProps,
  MenuToggleElement,
} from "@patternfly/react-core";

export const InlineMenuToggle = React.forwardRef(
  (props: MenuToggleProps, ref: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      icon={<Icon name="keyboard_arrow_down" />}
      innerRef={ref}
      variant="plain"
      className="agm-inline-menu-toggle"
      {...props}
    />
  ),
);

const DeviceMenu = ({ title, ariaLabel = undefined, activeItemId = undefined, children }) => {
  const menuId = useId();
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggleRef={toggleMenuRef}
      toggle={
        <InlineMenuToggle
          ref={toggleMenuRef}
          onClick={onToggle}
          isExpanded={isOpen}
          aria-label={ariaLabel}
          aria-controls={menuId}
        >
          {title}
        </InlineMenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu
          ref={menuRef}
          activeItemId={activeItemId}
          role="menu"
          id={menuId}
          onSelect={() => setIsOpen(false)}
        >
          <MenuContent>{children}</MenuContent>
        </Menu>
      }
      // @ts-expect-error
      popperProps={{ appendTo: document.body }}
    />
  );
};

const DeviceHeader = ({ title, children }) => {
  const [txt1, txt2] = title.split("%s");

  return (
    <h4>
      <span>{txt1}</span>
      {children}
      <span>{txt2}</span>
    </h4>
  );
};

export { DeviceHeader, DeviceMenu };
