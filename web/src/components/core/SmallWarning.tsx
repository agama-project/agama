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
import { Flex, Icon } from "@patternfly/react-core";
import PFWarningIcon from "@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon";
import { TranslatedString } from "~/i18n";

export default function SmallWarning({ text }: { text: TranslatedString }) {
  return (
    <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
      <Icon status="warning">
        <PFWarningIcon />
      </Icon>
      <strong>{text}</strong>
    </Flex>
  );
}
