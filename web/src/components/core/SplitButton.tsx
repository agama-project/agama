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

import React, { useId, useState } from "react";
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleAction,
  MenuToggleActionProps,
  MenuToggleProps,
} from "@patternfly/react-core";
import { Link } from "~/components/core";
import { isEmpty } from "~/utils";
import { _ } from "~/i18n";

/**
 * Types for props accepted by SplitButton
 *
 * NOTE: Unfortunately, it's not easy to restrict children to a specific
 * component type. For more information, see
 * https://www.totaltypescript.com/type-safe-children-in-react-and-typescript.
 * If necessary, consider replacing the children prop with explicit props instead.
 */
export type SplitButtonProps = React.PropsWithChildren<{
  /** The URL or path for the main action when it should be a link */
  href?: string;
  /** Label for the link or button acting as a main action */
  label: React.ReactNode;
  /** Accessible label for the toggle button */
  toggleAriaLabel?: MenuToggleProps["aria-label"];
  /** Variant styles of the menu toggle */
  variant?: MenuToggleProps["variant"];
  /** Callback to be triggred when main action is clicked */
  onClick?: MenuToggleActionProps["onClick"];
}>;

/**
 * Displays a primary, visible action with a set of related options hidden in an
 * expandable menu for the user to choose from.
 *
 * Built on top of PF/Dropdown, using PF/MenuToggle with a single
 * PF/MenuToggleAction for the splitButtonItems prop.
 */
const SplitButton = ({
  href,
  label,
  onClick,
  toggleAriaLabel = _("More actions"),
  variant = "primary",
  children,
}: SplitButtonProps) => {
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const toggleKey = `${menuId}-toggle`;
  const onSelect = () => setIsOpen(false);
  const onToggle = () => setIsOpen(!isOpen);

  if (isEmpty(href) && isEmpty(onClick)) {
    console.error(
      "`SplitButton` mounted with neither, `href` nor `onClick`. Please, provide at least one of these props.",
    );
  }

  if (isEmpty(children)) {
    console.error(
      "`SplitButton` mounted without additional actions, please provide them through children.",
    );
  }

  return (
    <Dropdown
      id={menuId}
      isOpen={isOpen}
      onSelect={onSelect}
      onOpenChange={(isOpen) => setIsOpen(isOpen)}
      toggle={(toggleRef) => (
        <MenuToggle
          variant={variant}
          ref={toggleRef}
          onClick={onToggle}
          splitButtonItems={[
            /**
             * FIXME: PatternFly/MenuToggleAction does not accept either the component
             * or role prop, difficulting to use a link (`<a>`) or a button with
             * role="link" for actions that navigate to another resource, which would be
             * semantically more appropriate.
             */
            href ? (
              <Link key={toggleKey} to={href} onClick={onClick} isInline variant="link">
                {label}
              </Link>
            ) : (
              <MenuToggleAction key={toggleKey} onClick={onClick}>
                {label}
              </MenuToggleAction>
            ),
          ]}
          isExpanded={isOpen}
          aria-haspopup
          aria-controls={menuId}
          aria-label={toggleAriaLabel}
        />
      )}
    >
      <DropdownList>{children}</DropdownList>
    </Dropdown>
  );
};

SplitButton.Item = DropdownItem;
export default SplitButton;
