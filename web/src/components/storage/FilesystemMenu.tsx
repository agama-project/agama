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

import React, { useId } from "react";
import { Divider, Flex } from "@patternfly/react-core";
import { generatePath, useNavigate } from "react-router";
import Text from "~/components/core/Text";
import MenuHeader from "~/components/core/MenuHeader";
import MenuButton from "~/components/core/MenuButton";
import { STORAGE as PATHS } from "~/routes/paths";
import { model } from "~/types/storage";
import * as driveUtils from "~/components/storage/utils/drive";
import { filesystemType, formattedPath } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

function deviceDescription(deviceModel: FilesystemMenuProps["deviceModel"]): string {
  const fs = filesystemType(deviceModel.filesystem);
  const mountPath = deviceModel.mountPath;
  const reuse = deviceModel.filesystem.reuse;

  // I don't think this can happen, maybe when loading a configuration not created with the UI
  if (!mountPath) {
    if (reuse) return _("The device will be mounted");
    return _("The device will be formatted");
  }

  const path = formattedPath(mountPath);

  // TRANSLATORS: %s is a formatted mount point (eg. '"/home'").
  if (reuse) return sprintf(_("The current file system will be mounted at %s"), path);

  // TRANSLATORS: %1$s is a filesystem type (eg. Btrfs), %2$s is a mount point (eg. '"/home"').
  return sprintf(_("The device will be formatted as %1$s and mounted at %2$s"), fs, path);
}

type FilesystemMenuProps = { deviceModel: model.Drive | model.MdRaid };

export default function FilesystemMenu({ deviceModel }: FilesystemMenuProps): React.ReactNode {
  const navigate = useNavigate();
  const ariaLabelId = useId();
  const toggleTextId = useId();
  const { list, listIndex } = deviceModel;
  const editFilesystemPath = generatePath(PATHS.formatDevice, { list, listIndex });

  // TRANSLATORS: %s is the name of device, like '/dev/sda'.
  const detailsAriaLabel = sprintf(_("Details for %s"), deviceModel.name);

  return (
    <Flex gap={{ default: "gapXs" }}>
      <Text id={ariaLabelId} srOnly>
        {detailsAriaLabel}
      </Text>
      <Text isBold aria-hidden>
        {_("Details")}
      </Text>
      <MenuButton
        menuProps={{
          "aria-label": detailsAriaLabel,
        }}
        toggleProps={{
          variant: "plainText",
          "aria-labelledby": `${ariaLabelId} ${toggleTextId}`,
        }}
        items={[
          <MenuHeader key="header-filesystem" description={deviceDescription(deviceModel)} />,
          <Divider key="divider-filesystem" component="li" />,
          <MenuButton.Item
            key="edit-filesystem"
            itemId="edit-filesystem"
            description={_("Change the file system or mount point")}
            onClick={() => navigate(editFilesystemPath)}
          >
            {_("Edit")}
          </MenuButton.Item>,
        ]}
      >
        <Text id={toggleTextId}>{driveUtils.contentDescription(deviceModel)}</Text>
      </MenuButton>
    </Flex>
  );
}
