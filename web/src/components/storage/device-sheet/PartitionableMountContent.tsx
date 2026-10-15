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
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import SheetItem from "~/components/storage/device-sheet/SheetItem";
import { filesystemLabel, formattedPath } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import { useSetFilesystem } from "~/hooks/model/storage/config-model";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { _ } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { DeviceDetailProps } from "~/components/storage/device-sheet/DeviceDetail";

/**
 * A file system taking the whole device, as the installation uses it: either
 * the one already there, used as it is, or a new one.
 *
 * Offers to change how it is used, and to stop using the device for it, which
 * leaves the device with nothing planned.
 */
export type PartitionableMountContentProps = DeviceDetailProps & {
  /** Whether to say "file system", which a heading saying the same makes redundant. */
  showName?: boolean;
};

export default function PartitionableMountContent({
  entry,
  subject,
  showName = true,
}: PartitionableMountContentProps) {
  const setFilesystem = useSetFilesystem();
  const config = entry.config as Partitionable.Device;
  const path = formattedPath(config.mountPath);
  const reuses = config.filesystem?.reuse === true;
  /* The one there now when it is kept, the one asked for otherwise. Left out
     where the installer is left to choose. */
  const type = reuses ? entry.device?.filesystem?.type : config.filesystem?.type;
  const label = type && filesystemLabel(type);

  const bold = () => <Text isBold>{label}</Text>;
  const where = () => path;

  /* The type first and in bold, as where the file system is reported today. */
  let value: React.ReactNode;
  if (reuses) {
    value = label ? (
      <Interpolate
        sentence={
          showName
            ? // TRANSLATORS: a file system on a whole device that the new system
              // uses as it is. The first %s is its type, such as "Ext4", shown in
              // bold, the second where it is mounted, such as "/home".
              _("%s file system, used for %s")
            : // TRANSLATORS: the same, under a heading that already says "File
              // system".
              _("%s, used for %s")
        }
      >
        {[bold, where]}
      </Interpolate>
    ) : (
      // TRANSLATORS: a file system on a whole device that the new system uses as
      // it is. %s is where it is mounted, such as "/home".
      sprintf(_("Used for %s"), path)
    );
  } else {
    value = label ? (
      <Interpolate
        sentence={
          showName
            ? // TRANSLATORS: a new file system on a whole device. The first %s is
              // its type, such as "Ext4", shown in bold, the second where it is
              // mounted, such as "/home".
              _("%s file system for %s")
            : // TRANSLATORS: the same, under a heading that already says "File
              // system".
              _("%s for %s")
        }
      >
        {[bold, where]}
      </Interpolate>
    ) : (
      // TRANSLATORS: a new file system on a whole device, of a type the installer
      // chooses. %s is where it is mounted, such as "/home".
      sprintf(_("For %s"), path)
    );
  }

  const editPath = generateEncodedPath(PATHS.formatDevice, {
    collection: subject.collection,
    index: String(subject.index),
  });

  return (
    <SheetItem icon="hard_drive" value={value}>
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
    </SheetItem>
  );
}
