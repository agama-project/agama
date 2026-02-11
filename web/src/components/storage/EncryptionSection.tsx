/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { Content, Flex, Split, Stack } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { Link } from "~/components/core";
import Icon from "~/components/layout/Icon";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";

function encryptionLabel(method?: ConfigModel.EncryptionMethod) {
  if (!method) return _("Encryption is disabled");
  if (method === "tpmFde") return _("Encryption is enabled using TPM unlocking");

  return _("Encryption is enabled");
}

export default function EncryptionSection() {
  const configModel = useConfigModel();
  const encryption = configModel?.encryption;
  const method = encryption?.method;

  return (
    <Stack hasGutter>
      <div className={textStyles.textColorPlaceholder}>
        {_(
          "Protection for the information stored at " +
            "the new file systems, including data, programs, and system files.",
        )}
      </div>
      <Content isEditorial>{encryptionLabel(method)}</Content>
      <Split hasGutter>
        <Link to={STORAGE.editEncryption} keepQuery variant="plain">
          <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
            <Icon name="edit_square" /> {_("Change")}
          </Flex>
        </Link>
      </Split>
    </Stack>
  );
}
