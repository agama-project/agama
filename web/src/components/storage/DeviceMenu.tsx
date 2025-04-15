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

import React, { useId, useRef, useState } from "react";
import {
  Menu,
  MenuProps,
  MenuContainer,
  MenuContent,
  MenuToggle,
  MenuToggleProps,
  MenuToggleElement,
} from "@patternfly/react-core";

const InlineMenuToggle = React.forwardRef(
  (props: MenuToggleProps, ref: React.Ref<MenuToggleElement>) => (
    <MenuToggle innerRef={ref} className="agm-inline-menu-toggle" {...props} />
  ),
);

export type DeviceMenuProps = {
  title: string | React.ReactNode;
  ariaLabel?: string;
  activeItemId?: MenuProps["activeItemId"];
  children: React.ReactNode;
};

export default function DeviceMenu({
  title,
  ariaLabel = undefined,
  activeItemId = undefined,
  children,
}: DeviceMenuProps) {
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
}
