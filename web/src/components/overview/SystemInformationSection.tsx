/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import {
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Flex,
  DescriptionListTermProps,
  DescriptionListDescriptionProps,
} from "@patternfly/react-core";
import xbytes from "xbytes";
import FormattedIPsList from "~/components/network/FormattedIpsList";
import NestedContent from "~/components/core/NestedContent";
import { useSystem } from "~/hooks/model/system";
import { _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

type ItemProps = {
  /** The label/term for this field */
  label: DescriptionListDescriptionProps["children"];
  /** The value/description for this field */
  children: DescriptionListDescriptionProps["children"];
  /** Additional props passed to the DescriptionListTerm component */
  termProps?: Omit<DescriptionListTermProps, "children">;
  /** Additional props passed to the DescriptionListDescription component */
  descriptionProps?: Omit<DescriptionListDescriptionProps, "children">;
};

/**
 * A single item in a `Details` description list.
 *
 * Wraps a PatternFly `DescriptionListGroup` with `DescriptionListTerm` and
 * `DescriptionListDescription`.
 */
const Item = ({ label, children, termProps = {}, descriptionProps = {} }: ItemProps) => {
  return (
    <DescriptionListGroup>
      <DescriptionListTerm {...termProps}>{label}</DescriptionListTerm>
      <DescriptionListDescription {...descriptionProps}>
        <small className={textStyles.textColorSubtle}>{children}</small>
      </DescriptionListDescription>
    </DescriptionListGroup>
  );
};

export default function SystemInformationSection() {
  const { hardware } = useSystem();

  return (
    <Card variant="secondary">
      <CardTitle component="h3">{_("System Information")}</CardTitle>
      <CardBody>
        <Flex gap={{ default: "gapMd" }} direction={{ default: "column" }}>
          <NestedContent margin="mxSm">
            <DescriptionList isCompact>
              <Item label={_("Model")}>{hardware.model}</Item>
              <Item label={_("CPU")}>{hardware.cpu}</Item>
              <Item label={_("Memory")}>
                {hardware.memory ? xbytes(hardware.memory, { iec: true }) : undefined}
              </Item>
              <Item label={_("IPs")}>
                <FormattedIPsList />
              </Item>
            </DescriptionList>
          </NestedContent>
        </Flex>
      </CardBody>
    </Card>
  );
}
