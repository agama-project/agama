/*
 * Copyright (c) [2026] SUSE LLC
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

import React from "react";
import { Button, ButtonProps, Flex } from "@patternfly/react-core";
import Icon, { IconProps } from "~/components/layout/Icon";

export type IconButtonProps = React.PropsWithChildren<
  Omit<ButtonProps, "icon" | "iconPosition"> & {
    /** Icon name to display before the text */
    icon?: IconProps["name"];
  }
>;

/**
 * Button component with optional icon support.
 *
 * When an icon is provided, it's automatically wrapped in a Flex container
 * for proper alignment with the button text.
 *
 * @example
 *   <IconButton variant="primary" onClick={save}>Save</IconButton>
 *
 * @example
 *   <IconButton variant="secondary" icon="restart_alt" onClick={reboot}>
 *     Reboot
 *   </IconButton>
 */
export default function IconButton({ children, icon, ...buttonProps }: IconButtonProps) {
  return (
    <Button {...buttonProps}>
      {icon ? (
        <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
          <Icon name={icon} /> {children}
        </Flex>
      ) : (
        children
      )}
    </Button>
  );
}
