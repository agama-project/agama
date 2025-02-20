/*
 * Copyright (c) [2024-2025] SUSE LLC
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
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
} from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import { EncryptionMethods } from "~/types/storage";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

const encryptionMethods = {
  disabled: _("Disabled"),
  [EncryptionMethods.LUKS2]: _("Enabled"),
  [EncryptionMethods.TPM]: _("Using TPM unlocking"),
};

// FIXME: temporary "mocks", please remove them after importing real code.
const useEncryption = () => ({ mode: "disabled" });
const useEncryptionChanges = () =>
  console.info(
    "Do not forget to susbscribe component to potential encryption changes. Maybe not needed if they come from model and subscribed to it.",
  );
// FIXME: read above ^^^

export default function EncryptionSection() {
  const { mode: value } = useEncryption();
  useEncryptionChanges();

  return (
    <Page.Section
      title={_("Encryption")}
      description={_(
        "Protection for the information stored at \
the device, including data, programs, and system files.",
      )}
      pfCardBodyProps={{ isFilled: true }}
      actions={<Link to={STORAGE.encryption}>{_("Edit")}</Link>}
    >
      <Card isCompact isPlain>
        <CardBody>
          <DescriptionList isHorizontal isFluid displaySize="lg" isCompact>
            <DescriptionListGroup>
              <DescriptionListTerm>{_("Mode")}</DescriptionListTerm>
              <DescriptionListDescription>{encryptionMethods[value]}</DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </CardBody>
      </Card>
    </Page.Section>
  );
}
