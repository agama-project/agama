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
import { storage } from "~/api/system";
import { useAvailableDrives } from "~/hooks/api/system/storage";
import { useModel } from "~/hooks/storage/model";
import { STORAGE } from "~/routes/paths";
import { deviceLabel, formattedPath } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

function defaultBootLabel(device?: storage.Device) {
  if (!device) {
    return sprintf(
      // TRANSLATORS: %s is replaced by the formatted path of the root file system (eg. "/")
      _(
        "Partitions to boot will be set up if needed at the installation disk, \
        based on the location of the %s file system.",
      ),
      formattedPath("/"),
    );
  }

  return sprintf(
    // TRANSLATORS: %1$s is replaced by a device name and size (e.g., sda (500GiB)), %2$s is
    // replaced by the formatted path of the root file system (eg. "/")
    _(
      "Partitions to boot will be set up if needed at the installation disk. \
      Currently %1$s, based on the location of the %2$s file system.",
    ),
    deviceLabel(device),
    formattedPath("/"),
  );
}

function bootLabel(isDefault: boolean, device?: storage.Device) {
  if (isDefault) {
    return defaultBootLabel(device);
  }

  if (!device) return _("No partitions will be automatically configured for booting.");

  return sprintf(
    // TRANSLATORS: %s is replaced by a disk name and size (eg. "sda (500GiB)")
    _("Partitions to boot will be set up if needed at %s."),
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
          "To ensure the new system is able to boot, the installer may need to create or configure some \
          partitions in the appropriate disk.",
        )}
      </div>
      <Content component="p" isEditorial>
        {bootLabel(boot.isDefault, device)}
      </Content>
      <Flex>
        <Link to={STORAGE.editBootDevice} keepQuery variant="plain">
          <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
            <Icon name="edit_square" /> {_("Change")}
          </Flex>
        </Link>
      </Flex>
    </Stack>
  );
}
