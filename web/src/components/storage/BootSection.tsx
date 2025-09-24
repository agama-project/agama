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
import { Content, Flex, Stack } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import Link from "~/components/core/Link";
import Icon from "~/components/layout/Icon";
import { StorageDevice } from "~/types/storage";
import { useAvailableDrives } from "~/hooks/storage/system";
import { useModel } from "~/hooks/storage/model";
import { STORAGE } from "~/routes/paths";
import { deviceLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

function bootLabel(isDefault: boolean, device?: StorageDevice) {
  if (isDefault) {
    return _(
      "If needed, partitions to boot will be automatically set up at the installation disk \
      (ie. the one containing the '/' file system).",
    );
  }

  if (!device) return _("The installer will not automatically set up any partition for booting.");

  // TRANSLATORS: %s is replaced by a disk name and size (eg. "sda (500GiB)")
  return sprintf(
    _("If needed, partitions to boot will be automatically set up at %s"),
    deviceLabel(device),
  );
}

export default function BootSection() {
  const model = useModel({ suspense: true });
  const boot = model.boot;
  const devices = useAvailableDrives();
  const device = devices.find((d) => d.name === boot.getDevice()?.name);

  return (
    <Stack hasGutter>
      <div className={textStyles.textColorPlaceholder}>
        {_(
          "To ensure the new system is able to boot, the installer may create or configure some \
          partitions in the appropriate disk.",
        )}
      </div>
      <Content component="p" isEditorial>
        {bootLabel(boot.isDefault, device)}
      </Content>
      <Flex>
        <Link to={STORAGE.editBootDevice} variant="plain">
          <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
            <Icon name="edit_square" /> {_("Change")}
          </Flex>
        </Link>
      </Flex>
    </Stack>
  );
}
