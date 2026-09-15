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
import { sprintf } from "sprintf-js";
import Link from "~/components/core/Link";
import Statement from "~/components/storage/device-sheet/Statement";
import { bootPartitionsOf } from "~/components/storage/shared/boot";
import { deviceSize } from "~/components/storage/utils";
import { STORAGE as PATHS } from "~/routes/paths";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useProposalDevices } from "~/hooks/model/proposal/storage";
import { _, formatList } from "~/i18n";
import type { Entry } from "~/components/storage/device-sheet/entry";

export type BootStatementProps = {
  entry: Entry;
};

/**
 * That the machine will start from this device, why, and what that costs it.
 *
 * The two answers no other view gives: whether the installer picked the device
 * or the reader did, and which partitions booting takes. How the automatic
 * choice is worked out is a longer story, and the boot options page is where it
 * is already told, so the statement ends with the way there: a reader who has
 * just learned the installer chose for them is the one most likely to want it.
 */
export default function BootStatement({ entry }: BootStatementProps): React.ReactNode {
  const config = useConfigModel();
  const staging = useProposalDevices();
  const name = entry.config.name;

  if (!config || !name || !configModel.boot.hasDevice(config, name)) return null;

  const partitions = bootPartitionsOf(name, entry.device, staging).map((partition) =>
    partition.isNew
      ? sprintf(
          // TRANSLATORS: one partition the installer adds to start the machine.
          // %s is its size, such as "8 MiB".
          _("a new partition (%s)"),
          partition.size === undefined ? "" : deviceSize(partition.size),
        )
      : sprintf(
          // TRANSLATORS: one partition already on the disk that the installer
          // uses to start the machine. %s is its name, such as "vda1".
          _("%s, reused"),
          partition.name,
        ),
  );

  return (
    <Statement
      icon="info"
      heading={
        configModel.boot.isDefault(config)
          ? // TRANSLATORS: says a device will start the machine, and that the
            // installer chose it rather than the reader.
            _("Boot device, chosen automatically.")
          : // TRANSLATORS: says a device will start the machine.
            _("Boot device.")
      }
    >
      {partitions.length
        ? sprintf(
            // TRANSLATORS: the partitions starting the machine takes on a device.
            // %s is a list of them, such as "a new partition (8 MiB)".
            _("Partitions to boot: %s."),
            formatList(partitions),
          )
        : // TRANSLATORS: said of a boot device that needs no partition of its
          // own to start the machine.
          _("No partition to boot needed.")}{" "}
      <Link to={PATHS.editBootDevice} keepQuery variant="link" isInline>
        {
          // TRANSLATORS: link to the page where booting is decided.
          _("Check boot options")
        }
      </Link>
    </Statement>
  );
}
