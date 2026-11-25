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
import { Button, Flex } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import Link from "~/components/core/Link";
import DetailsItem from "~/components/storage/device-details/DetailsItem";
import { filesystemLabel, formattedPath } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import { useSetFilesystem } from "~/hooks/model/storage/config-model";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { _ } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { DeviceDetailsBodyProps } from "~/components/storage/device-details/DeviceDetailsBody";

export default function PartitionableMountContent({ entry, subject }: DeviceDetailsBodyProps) {
  const setFilesystem = useSetFilesystem();
  const config = entry.config as Partitionable.Device;
  const path = formattedPath(config.mountPath);
  const reuses = config.filesystem?.reuse === true;
  /* The one there now when it is kept, the one asked for otherwise. Left out
     where the installer is left to choose. */
  const type = reuses ? entry.device?.filesystem?.type : config.filesystem?.type;
  const label = type && filesystemLabel(type);

  /* The type first and in bold, as where the file system is reported today. */
  let value: React.ReactNode;
  if (reuses) {
    value = label
      ? // TRANSLATORS: %1$s is a file system type ext4, %2$s is an escaped label name like "home"
        // and %3$s is an escaped mount path like "/home"
        sprintf(_("The existing %1$s file system will be mounted at %2$s."), label, path)
      : // TRANSLATORS: %s is an escaped mount path like "/home"
        sprintf(_("The existing file system will be mounted at %s."), path);
  } else {
    value = label
      ? sprintf(
          // TRANSLATORS: %1$s is a file system type ext4, %2$s is an escaped mount path like "/home"
          _("The device will be formatted as %1$s and mounted at %2$s."),
          label,
          path,
        )
      : // TRANSLATORS: %s is an escaped mount path like "/home"
        sprintf(_("The device will be formatted and mounted at %s."), path);
  }

  const editPath = generateEncodedPath(PATHS.formatDevice, {
    collection: subject.collection,
    index: String(subject.index),
  });

  return (
    <DetailsItem value={value}>
      <Flex gap={{ default: "gapMd" }} flexWrap={{ default: "wrap" }}>
        <Link to={editPath} keepQuery variant="link" isInline>
          {/* TRANSLATORS: changes how a file system on a whole device is used. */}
          {_("Edit")}
        </Link>
        {/* A button, since it acts in place, drawn like the link beside it so
            the two read as one set of actions. */}
        <Button
          variant="link"
          isInline
          onClick={() => {
            if (configModel.partitionable.isCollectionName(subject.collection))
              setFilesystem(subject.collection, subject.index, {});
          }}
        >
          {/* TRANSLATORS: stops using a whole device for a file system, leaving
              nothing planned on it. */}
          {_("Stop using")}
        </Button>
      </Flex>
    </DetailsItem>
  );
}
