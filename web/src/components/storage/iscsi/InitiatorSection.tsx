/*
 * Copyright (c) [2023-2025] SUSE LLC
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

import { _ } from "~/i18n";
import { Page } from "~/components/core";
import {
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
} from "@patternfly/react-core";
import { InitiatorForm } from "~/components/storage/iscsi";
import { useInitiator, useInitiatorMutation, useInitiatorChanges } from "~/queries/storage/iscsi";

const InitiatorDescription = ({ initiator }) => {
  return (
    <DescriptionList aria-label={_("Initiator details")} isHorizontal isFluid>
      <DescriptionListGroup>
        <DescriptionListTerm>{_("Name")}</DescriptionListTerm>
        <DescriptionListDescription>{initiator.name}</DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
};

export default function InitiatorSection() {
  const initiator = useInitiator();
  const { mutateAsync: updateInitiator } = useInitiatorMutation();
  useInitiatorChanges();

  const submitForm = async ({ name }) => {
    await updateInitiator({ name });
  };

  const desc = initiator.ibft
    ? _("Configuration read from the iSCSI Boot Firmware Table (iBFT).")
    : _("No iSCSI Boot Firmware Table (iBFT) found. The initiator can be configured manually.");

  return (
    // TRANSLATORS: iSCSI initiator section name
    <Page.Section title={_("Initiator")} description={desc}>
      {initiator.ibft && <InitiatorDescription initiator={initiator} />}
      {!initiator.ibft && <InitiatorForm initiator={initiator} onSubmit={submitForm} />}
    </Page.Section>
  );
}
