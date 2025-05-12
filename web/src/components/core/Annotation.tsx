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

import React from "react";
import { Flex } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { IconProps } from "../layout/Icon";

type AnnotationProps = React.PropsWithChildren<{
  icon?: IconProps["name"];
}>;

/**
 * Displays a short note or clarification, typically marked with an asterisk.
 * Useful for setup tips, footnotes, or optional context in the UI.
 */
export default function Annotation({ icon = "emergency", children }: AnnotationProps) {
  return (
    <Flex component="p" alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
      <Icon name={icon} /> <b>{children}</b>
    </Flex>
  );
}
