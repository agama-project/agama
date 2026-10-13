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
import { unique } from "radashi";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import { Stack, StackItem } from "@patternfly/react-core";
import SmallWarning from "~/components/core/SmallWarning";
import SheetOpener from "~/components/storage/shared/SheetOpener";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { useActions } from "~/hooks/model/proposal/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { baseName } from "~/components/storage/utils";
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import { isLogicalVolume, isPartition } from "~/model/storage/device";
import { _, n_, formatList, TranslatedString } from "~/i18n";
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
      "Includes %1$d destructive actions affecting %2$s.",
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
            "Includes a non-destructive reduction of %1$d partitions affecting %2$s.",
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
            "Includes a non-destructive reduction of %1$d logical volumes affecting %2$s.",
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
          "Includes a non-destructive reduction of %1$d partitions and logical volumes affecting %2$s.",
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

/**
 * The disks the plan is about, named while there are few enough to name and
 * counted after that, following the page's naming rule.
 */
function devicesPhrase(devices: string[]): string {
  if (devices.length <= NAMES_PER_LINE) return formatList(devices);

  // TRANSLATORS: stands for the devices the installation uses, where there are
  // too many to name. %d is how many.
  return sprintf(n_("%d device", "%d devices", devices.length), devices.length);
}

/**
 * The opening sentence: what the plan builds, where, and what it takes.
 *
 * Where it comes from is left to the heading above it, so the sentence only
 * gives facts. It opens with words rather than a number, which reads as a
 * sentence instead of a figure, and carries no emphasis so the warning under
 * it stays the only thing that stands out. The devices sit inside the subject
 * rather than being it, so the verb never has to agree with a list of names.
 */
function summary(count: number, devices: string[]): TranslatedString {
  if (!devices.length) {
    return sprintf(
      n_(
        // TRANSLATORS: summary of what the installer will do to the disks.
        // %d is the number of steps.
        "Setting up the final storage layout will take %d action.",
        "Setting up the final storage layout will take %d actions.",
        count,
      ),
      count,
    );
  }

  if (!count) {
    return sprintf(
      // TRANSLATORS: summary where the configuration asks for no change. %s is
      // a list of device names, such as "sda and sdb", or a count of them,
      // such as "5 devices".
      _("Nothing will be changed on %s."),
      devicesPhrase(devices),
    );
  }

  return sprintf(
    n_(
      // TRANSLATORS: summary of what the installer will do to the disks. %1$s
      // is a list of device names, such as "sda and sdb", or a count of them,
      // such as "5 devices". %2$d is the number of steps.
      "Setting up the final storage layout on %1$s will take %2$d action.",
      "Setting up the final storage layout on %1$s will take %2$d actions.",
      count,
    ),
    devicesPhrase(devices),
    count,
  );
}

/**
 * The worst thing the plan does to what is already on the machine, named.
 *
 * A reader wants to know whether any of the installation matters to them, and
 * a count of actions does not answer that. Naming the worst act does, in one
 * clause, without becoming a paragraph of consequences.
 *
 * Deliberately not a summary. Where a plan both deletes and shrinks, only the
 * deletion is named: what this says is the worst of it, not all of it. And a
 * name always survives, however many there are, because "3 existing systems"
 * tells a reader with Windows on the disk nothing they can recognize.
 *
 * It is a statement and not a control. The color belongs to the loss rather
 * than to anything the reader can press, and nothing rides on seeing it: the
 * words say what is deleted.
 *
 * Read from the actions the solver produced, so it reports what will happen
 * rather than what the configuration asked for. Nothing is reported when there
 * is no proposal to read, which is what leaves room for the page to say why.
 *
 * Above it, a plain sentence saying what the plan builds and what it takes.
 * It holds no control: a sentence with a link in the middle of it cannot be
 * translated as one, and two links in one sentence leading to the same panel
 * read as two places.
 *
 * Below both, and never colored with them, the one way into the whole picture,
 * named for where it goes. What the plan destroys and what it does step by step
 * are two questions, and a reader has the first whether or not they ever have
 * the second. A link that changes appearance with what the plan happens to do
 * is a link they have to recognize twice, and its danger was never its own: it
 * opens a panel.
 */
export default function Consequences(): React.ReactNode {
  const actions = useActions();
  const manager = useDevicesManager();
  const config = useConfigModel();

  /* Subvolumes are how one file system is laid out inside itself, so counting
     them tells a reader how the installer works rather than what it will do. */
  const counted = actions.filter((action) => !action.subvol);
  const devices = [...(config?.drives || []), ...(config?.mdRaids || [])].map((device) =>
    baseName(device.name),
  );
  if (!counted.length && !devices.length) return null;

  const deleted = deletion(unique(manager.deletedSystems()), manager.deletedDevices().length);
  const resized = resize(unique(manager.resizedSystems()), manager.resizedDevices());

  return (
    <Stack>
      <StackItem>{summary(counted.length, devices)}</StackItem>
      {deleted && <SmallWarning text={deleted} />}
      {!deleted && resized && <Text isBold>{resized}</Text>}
      <StackItem>
        <SheetOpener subject="result">
          {/* TRANSLATORS: opens a panel showing how the disks will look after
              installation and the list of steps taken to get there. */}
          {_("See the final layout and actions")}
        </SheetOpener>
      </StackItem>
    </Stack>
  );
}
