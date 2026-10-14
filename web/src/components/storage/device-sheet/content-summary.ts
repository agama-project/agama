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

import { sprintf } from "sprintf-js";
import { unique } from "radashi";
import { deviceSize } from "~/components/storage/utils";
import { _, n_, formatList } from "~/i18n";
import type { TranslatedString } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";

/** Something on the device today, as far as the summary needs to know it. */
export type ContentPart = {
  /** Short name, such as "vdd4". */
  name: string;
  /** Operating systems found on it. */
  systems: string[];
  /** Where the new system uses it, if it does. No space option reaches it then. */
  reusedAs?: string;
  /** How much shrinking it could free, if it can be shrunk. */
  recoverable?: number;
};

export type ContentKind = "partitions" | "logicalVolumes";

const isPartitions = (kind: ContentKind) => kind === "partitions";

/** Parts the new system uses, named while there are few of them. */
function spokenFor(parts: ContentPart[]): TranslatedString {
  if (parts.length > 2) {
    return sprintf(
      // TRANSLATORS: ends a sentence such as "Deletes 1 partition and its
      // data, except 4 reused": how many parts the new system uses as they
      // are. %d is how many.
      n_("%d reused", "%d reused", parts.length),
      parts.length,
    );
  }

  return formatList(
    parts.map((part) =>
      // TRANSLATORS: a partition the new system uses. %1$s is its name, such
      // as "vdd4", %2$s where it is mounted, such as "/home".
      sprintf(_("%1$s (for %2$s)"), part.name, part.reusedAs),
    ),
  );
}

function deleting(
  kind: ContentKind,
  parts: ContentPart[],
  reused: ContentPart[],
): TranslatedString {
  const count = parts.length;

  /* One extra clause at most. A part the option does not reach is the
     exception to it, so it wins over naming the systems lost. */
  if (reused.length) {
    return sprintf(
      isPartitions(kind)
        ? // TRANSLATORS: what deleting the content of a disk does. %1$d is how
          // many partitions go, %2$s the ones the new system keeps, such as
          // "vdd4 (for /home)" or "4 reused".
          n_(
            "Deletes %1$d partition and its data, except %2$s",
            "Deletes %1$d partitions and their data, except %2$s",
            count,
          )
        : // TRANSLATORS: what deleting the content of a volume group does. %1$d
          // is how many logical volumes go, %2$s the ones the new system keeps.
          n_(
            "Deletes %1$d logical volume and its data, except %2$s",
            "Deletes %1$d logical volumes and their data, except %2$s",
            count,
          ),
      count,
      spokenFor(reused),
    );
  }

  const systems = unique(parts.flatMap((part) => part.systems));
  if (systems.length) {
    return sprintf(
      isPartitions(kind)
        ? // TRANSLATORS: what deleting the content of a disk does. %1$d is how
          // many partitions go, %2$s the operating systems found on them.
          n_(
            "Deletes %1$d partition and its data, including %2$s",
            "Deletes %1$d partitions and their data, including %2$s",
            count,
          )
        : // TRANSLATORS: what deleting the content of a volume group does. %1$d
          // is how many logical volumes go, %2$s the operating systems on them.
          n_(
            "Deletes %1$d logical volume and its data, including %2$s",
            "Deletes %1$d logical volumes and their data, including %2$s",
            count,
          ),
      count,
      formatList(systems),
    );
  }

  return sprintf(
    isPartitions(kind)
      ? // TRANSLATORS: what deleting the content of a disk does. %d is how many
        // partitions go.
        n_("Deletes %d partition and its data", "Deletes %d partitions and their data", count)
      : // TRANSLATORS: what deleting the content of a volume group does. %d is
        // how many logical volumes go.
        n_(
          "Deletes %d logical volume and its data",
          "Deletes %d logical volumes and their data",
          count,
        ),
    count,
  );
}

function shrinking(kind: ContentKind, parts: ContentPart[]): TranslatedString {
  const shrinkable = parts.filter((part) => part.recoverable !== undefined);

  if (!shrinkable.length) {
    return isPartitions(kind)
      ? // TRANSLATORS: none of the partitions on a disk can be made smaller.
        _("No partition can be shrunk")
      : // TRANSLATORS: none of the logical volumes in a volume group can be
        // made smaller.
        _("No logical volume can be shrunk");
  }

  const freed = shrinkable.reduce((sum, part) => sum + part.recoverable, 0);

  return sprintf(
    isPartitions(kind)
      ? // TRANSLATORS: what shrinking partitions on a disk does. %1$d is how many
        // can be made smaller, %2$s the most space that can be freed, such as
        // "30 GiB".
        n_(
          "May shrink %1$d partition, freeing up to %2$s",
          "May shrink %1$d partitions, freeing up to %2$s",
          shrinkable.length,
        )
      : // TRANSLATORS: what shrinking logical volumes does. %1$d is how many can
        // be made smaller, %2$s the most space that can be freed.
        n_(
          "May shrink %1$d logical volume, freeing up to %2$s",
          "May shrink %1$d logical volumes, freeing up to %2$s",
          shrinkable.length,
        ),
    shrinkable.length,
    deviceSize(freed),
  );
}

function keeping(kind: ContentKind, count: number, freeSpace: number): TranslatedString {
  if (!freeSpace) {
    return sprintf(
      isPartitions(kind)
        ? // TRANSLATORS: what keeping the partitions of a full disk does. %d is
          // how many.
          n_(
            "Keeps %d partition, with no free space to use",
            "Keeps %d partitions, with no free space to use",
            count,
          )
        : // TRANSLATORS: what keeping the logical volumes of a full volume group
          // does. %d is how many.
          n_(
            "Keeps %d logical volume, with no free space to use",
            "Keeps %d logical volumes, with no free space to use",
            count,
          ),
      count,
    );
  }

  return sprintf(
    isPartitions(kind)
      ? // TRANSLATORS: what keeping the partitions of a disk does. %1$d is how
        // many, %2$s the free space the new system uses, such as "2 GiB".
        n_(
          "Keeps %1$d partition, using %2$s of free space",
          "Keeps %1$d partitions, using %2$s of free space",
          count,
        )
      : // TRANSLATORS: what keeping the logical volumes of a volume group does.
        // %1$d is how many, %2$s the free space the new system uses.
        n_(
          "Keeps %1$d logical volume, using %2$s of free space",
          "Keeps %1$d logical volumes, using %2$s of free space",
          count,
        ),
    count,
    deviceSize(freeSpace),
  );
}

/**
 * One line saying what the chosen space option does to what is on a device,
 * built from what happens to each part rather than from the option alone.
 *
 * It starts with a verb, never a number, and holds one extra clause at most.
 * Nothing is said under the custom option, where the table is always shown.
 * Parts the new system uses are out of every option's reach, so they are left
 * out of the count and named as the exception.
 *
 * @example
 * contentSummary("partitions", "delete", parts, 0)
 * // "Deletes 3 partitions and their data, except vdd4 (for /home)"
 */
export default function contentSummary(
  kind: ContentKind,
  policy: ConfigModel.SpacePolicy,
  parts: ContentPart[],
  freeSpace: number,
): TranslatedString | undefined {
  /* Under the custom option the table is always shown, and its Action column
     is the answer. */
  if (!parts.length || policy === "custom") return undefined;

  const reused = parts.filter((part) => part.reusedAs !== undefined);
  const governed = parts.filter((part) => part.reusedAs === undefined);

  if (!governed.length) {
    return sprintf(
      isPartitions(kind)
        ? // TRANSLATORS: every partition on a disk is used by the new system, so
          // no space option reaches any. %d is how many there are.
          n_(
            "Uses the partition for the new system",
            "Uses all %d partitions for the new system",
            reused.length,
          )
        : // TRANSLATORS: every logical volume is used by the new system. %d is
          // how many there are.
          n_(
            "Uses the logical volume for the new system",
            "Uses all %d logical volumes for the new system",
            reused.length,
          ),
      reused.length,
    );
  }

  switch (policy) {
    case "delete":
      return deleting(kind, governed, reused);
    case "resize":
      return shrinking(kind, governed);
    case "keep":
      return keeping(kind, governed.length, freeSpace);
  }
}
