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
import xbytes from "xbytes";
import { isEmpty } from "radashi";
import {
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
} from "@patternfly/react-core";
import FormattedIPsList from "~/components/network/FormattedIpsList";
import NestedContent from "~/components/core/NestedContent";
import { useSystem } from "~/hooks/model/system";
import { _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

type ItemProps = {
  /** The label/term for this field */
  label: string;
  /** The value/description for this field */
  children: React.ReactNode;
};

/**
 * A single item in a `SystemInformationSection` description list.
 */
const Item = ({ label, children }: ItemProps) => {
  return (
    <DescriptionListGroup>
      <DescriptionListTerm>{label}</DescriptionListTerm>
      <DescriptionListDescription>
        <small className={textStyles.textColorSubtle}>
          {isEmpty(children) ? _("Unknown") : children}
        </small>
      </DescriptionListDescription>
    </DescriptionListGroup>
  );
};

/**
 * Displays basic hardware information (model, CPU, memory, IPs) in a card.
 *
 * Fields with missing or undefined values fall back to "Unknown" rather than
 * rendering a blank space.
 *
 * @note A11y: `DescriptionList` renders a `<dl>/<dt>/<dd>` structure. Screen
 * reader support is generally good, with the exception of Safari/VoiceOver on
 * macOS where virtual cursor navigation exposes each term and description as
 * plain text without list semantics. A table-based alternative was evaluated
 * but discarded by now: `<th scope="row">` combined with `dataLabel` might
 * caused double label announcement for screen reader users, and the component's
 * default white background conflicted with the card's secondary variant
 * styling. This is a known limitation to revisit if a better PF alternative
 * becomes available.
 * @see https://adrianroselli.com/2022/12/brief-note-on-description-list-support.html
 */
export default function SystemInformationSection() {
  const { hardware } = useSystem();

  return (
    <Card variant="secondary">
      <CardTitle component="h3">{_("System Information")}</CardTitle>
      <CardBody>
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
      </CardBody>
    </Card>
  );
}
