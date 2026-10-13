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
import Interpolate from "~/components/core/Interpolate";
import { Stack, StackItem } from "@patternfly/react-core";
import SmallWarning from "~/components/core/SmallWarning";
import SheetOpener from "~/components/storage/shared/SheetOpener";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { useActions } from "~/hooks/model/proposal/storage";
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

/** How many actions the plan takes, in bold so it can be read at a glance. */
function ActionsCount({ count }: { count: number }): React.ReactNode {
  return (
    <Text component="strong">
      {
        // TRANSLATORS: how many steps the installer will take on the disks, as
        // part of the summary sentence. %d is the number.
        sprintf(n_("%d action", "%d actions", count), count)
      }
    </Text>
  );
}

/**
 * The opening sentence: what the plan builds and what it takes.
 *
 * Where the plan comes from is left to the heading above it, so the sentence
 * only gives facts. It opens with what is being built rather than with a
 * number, and its subject is the installer, so the verb never has to agree
 * with the count.
 *
 * The disks are not named: the configuration right below names every one of
 * them, and naming them here too would only make the sentence longer, and make
 * it read differently depending on how many there are. The count is bold and carries no
 * color, so it stands out without competing with the warning under it.
 *
 * The count reads as what the reader's plan takes, not as what the installer
 * decided on its own: the heading names the configuration as its source, and
 * "will need" makes the actions the cost of the layout.
 */
function Summary({ count }: { count: number }): React.ReactNode {
  if (!count) {
    // TRANSLATORS: summary where the configuration on the page asks for no
    // change to the disks.
    return _("The installer will not need to change anything on the disks.");
  }

  return (
    <Interpolate
      sentence={
        // TRANSLATORS: summary of what the installer will do to the disks to
        // leave them as configured on the page. %s is a number of steps, such
        // as "12 actions".
        _("To set up the final storage layout, the installer will need %s.")
      }
    >
      {() => <ActionsCount count={count} />}
    </Interpolate>
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
 * Above it, a sentence saying what the plan builds and what it takes. It holds
 * no control: a sentence with a link in the middle of it cannot be
 * translated as one, and two links in one sentence leading to the same panel
 * read as two places.
 *
 * Below both, and never colored with them, the one way into the whole picture,
 * named for where it goes and drawn as a button, since it stands on its own
 * line rather than inside a sentence. What the plan destroys and what it does step by step
 * are two questions, and a reader has the first whether or not they ever have
 * the second. A link that changes appearance with what the plan happens to do
 * is a link they have to recognize twice, and its danger was never its own: it
 * opens a panel.
 */
export default function Consequences(): React.ReactNode {
  const actions = useActions();
  const manager = useDevicesManager();

  /* Subvolumes are how one file system is laid out inside itself, so counting
     them tells a reader how the installer works rather than what it will do. */
  const counted = actions.filter((action) => !action.subvol);

  const deleted = deletion(unique(manager.deletedSystems()), manager.deletedDevices().length);
  const resized = resize(unique(manager.resizedSystems()), manager.resizedDevices());

  return (
    <Stack>
      <StackItem>
        <Summary count={counted.length} />
      </StackItem>
      {deleted && <SmallWarning text={deleted} />}
      {!deleted && resized && <Text isBold>{resized}</Text>}
      <StackItem>
        <SheetOpener subject="result" variant="secondary">
          {/* TRANSLATORS: opens a panel showing how the disks will look after
              installation and the list of steps taken to get there. */}
          {_("See the final layout and actions")}
        </SheetOpener>
      </StackItem>
    </Stack>
  );
}
