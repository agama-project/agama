/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { unique } from "radashi";
import { n_, formatList, TranslatedString } from "~/i18n";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import SmallWarning from "~/components/core/SmallWarning";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { isLogicalVolume, isPartition } from "~/model/storage/device";
import type { Storage as System } from "~/model/system";

function deletion(systems: string[], partitions: number): TranslatedString | null {
  if (!systems.length && !partitions) return null;

  if (!systems.length) {
    return sprintf(
      n_("Includes %d destructive action", "Includes %d destructive actions", partitions),
      partitions,
    );
  }

  return sprintf(
    n_(
      "Includes %1$d destructive action affecting %2$s.",
      "Includes %1$d destructive actions affecting at least %2$s.",
      partitions,
    ),
    partitions,
    formatList(systems),
  );
}

/**
 * What the plan makes smaller, in the words for the things it makes smaller.
 *
 * Shrinking a partition and shrinking a logical volume are the same act on two
 * different kinds of thing, and a reader looking for theirs knows it by its
 * kind. Only where both are shrunk are they named together, because that is the
 * only case where neither word alone is true.
 *
 * The count is of everything shrunk, not of the kind named. Where the kinds are
 * mixed the clause names both, so the number has to cover both; and where they
 * are not, there is only one kind to count.
 *
 * Anything that is neither falls in with the mixed case rather than inventing a
 * third wording for it. A shrunken RAID is not a partition, but it is sharing
 * the sentence with things that are, and "partitions and logical volumes" is
 * the phrase this already has for a plan whose parts do not go by one word.
 */
function resize(systems: string[], devices: System.Device[]): TranslatedString | null {
  if (!devices.length) return null;

  const count = devices.length;
  const named = formatList(systems);

  if (devices.every(isPartition)) {
    return systems.length
      ? sprintf(
          n_(
            // TRANSLATORS: %1$d is the number of partitions being made smaller,
            // %2$s a list of the operating systems installed on them.
            "Includes a non-destructive reduction of %1$d partition affecting %2$s.",
            "Includes non-destructive reductions of %1$d partitions affecting at least %2$s.",
            count,
          ),
          count,
          named,
        )
      : sprintf(
          // TRANSLATORS: %d is the number of partitions being made smaller.
          n_(
            "Includes a non-destructive reduction of %d partition.",
            "Includes a non-destructive reduction of %d partitions.",
            count,
          ),
          count,
        );
  }

  if (devices.every(isLogicalVolume)) {
    return systems.length
      ? sprintf(
          n_(
            // TRANSLATORS: %1$d is the number of logical volumes being made
            // smaller, %2$s a list of the operating systems installed on them.
            "Includes a non-destructive reduction of %1$d logical volume affecting %2$s.",
            "Includes non-destructive reductions of %1$d logical volumes affecting at least %2$s.",
            count,
          ),
          count,
          named,
        )
      : sprintf(
          // TRANSLATORS: %d is the number of logical volumes being made smaller.
          n_(
            "Includes a non-destructive reduction of %d logical volume.",
            "Includes a non-destructive reduction of %d logical volumes.",
            count,
          ),
          count,
        );
  }

  /* Both kinds at once, which takes two or more of them: the singular is here
     for the languages that still need a form for it, not because it can show. */
  return systems.length
    ? sprintf(
        n_(
          // TRANSLATORS: %1$d is the number of partitions and logical volumes
          // being made smaller, counted together, %2$s a list of the operating
          // systems installed on them.
          "Includes a non-destructive reduction of %1$d partition and logical volume affecting %2$s.",
          "Includes non-destructive reductions of %1$d partitions and logical volumes affecting at least %2$s.",
          count,
        ),
        count,
        named,
      )
    : sprintf(
        n_(
          // TRANSLATORS: %d is the number of partitions and logical volumes
          // being made smaller, counted together.
          "Includes a non-destructive reduction of %d partition and logical volume.",
          "Includes a non-destructive reduction of %d partitions and logical volumes.",
          count,
        ),
        count,
      );
}

export default function ProposalHighlightedActions(): React.ReactNode {
  const manager = useDevicesManager();
  const deleted = deletion(unique(manager.deletedSystems()), manager.deletedDevices().length);
  const resized = resize(unique(manager.resizedSystems()), manager.resizedDevices());

  if (deleted) return <SmallWarning text={deleted} />;
  if (resized) return <Text isBold>{resized}</Text>;
  return null;
}
