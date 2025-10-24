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
import { Card, CardBody, Content } from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import { useEncryption } from "~/queries/storage/config-model";
import { apiModel } from "~/api/storage/types";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";
import PasswordCheck from "~/components/users/PasswordCheck";

function encryptionLabel(method?: apiModel.EncryptionMethod) {
  if (!method) return _("Encryption is disabled");
  if (method === "tpmFde") return _("Encryption is enabled using TPM unlocking");

  return _("Encryption is enabled");
}

export default function EncryptionSection() {
  const { encryption } = useEncryption();
  const method = encryption?.method;
  const password = encryption?.password;

  return (
    <Page.Section
      title={_("Encryption")}
      description={_(
        "Protection for the information stored at \
the new file systems, including data, programs, and system files.",
      )}
      pfCardBodyProps={{ isFilled: true }}
      actions={<Link to={STORAGE.editEncryption}>{_("Edit")}</Link>}
    >
      <Card isCompact isPlain>
        <CardBody>
          <Content component="p">{encryptionLabel(method)}</Content>
          {password && <PasswordCheck password={password} />}
        </CardBody>
      </Card>
    </Page.Section>
  );
}
