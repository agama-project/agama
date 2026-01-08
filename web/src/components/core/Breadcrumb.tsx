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
import { Flex } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

const BreadcrumbItem = ({ label, path, hideDivider = false, isEditorial = false }) => {
  const Label = () => (
    <Text isBold={isEditorial} className={isEditorial && textStyles.fontSizeLg}>
      {label}
    </Text>
  );
  return (
    <Flex
      component="li"
      gap={{ default: "gapXs" }}
      alignContent={{ default: "alignContentCenter" }}
      alignItems={{ default: "alignItemsCenter" }}
    >
      {!hideDivider && <Icon name="chevron_right" />}
      <Link to={path} variant="link" isInline>
        <Label />
      </Link>
    </Flex>
  );
};

const Breadcrumb = ({ children }) => {
  return (
    <Flex component="ul" gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
      {children}
    </Flex>
  );
};

Breadcrumb.Item = BreadcrumbItem;

export default Breadcrumb;
