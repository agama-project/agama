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
import DevicesManager from "~/model/storage/devices-manager";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import {
  useFlattenDevices as useProposalDevices,
  useActions,
} from "~/hooks/model/proposal/storage";
import { _, n_, formatList, TranslatedString } from "~/i18n";

/**
 * Every sentence is written whole, one per case, instead of a verb joined to a
 * subject built somewhere else. A translator needs the finished sentence to
 * choose a verb form, and in several languages the subject changes case after
 * it, which no amount of joining can produce.
 */
function deletion(systems: string[], partitions: number): TranslatedString | null {
  if (systems.length > 2) {
    const others = systems.length - 1;
    return sprintf(
      // TRANSLATORS: What the installation destroys, where more systems are
      // affected than the sentence names. %1$s is the name of an operating
      // system found on the disks, like "Windows 11"; %2$d is how many other
      // systems go with it.
      n_("Deleting %1$s and %2$d other system.", "Deleting %1$s and %2$d other systems.", others),
      systems[0],
      others,
    );
  }

  if (systems.length) {
    return sprintf(
      // TRANSLATORS: What the installation destroys. %s is one or two names of
      // operating systems found on the disks, like "Windows 11" or
      // "Windows 11 and openSUSE Leap 15.2".
      _("Deleting %s."),
      formatList(systems),
    );
  }

  if (partitions) {
    return sprintf(
      // TRANSLATORS: What the installation destroys, where it recognizes no
      // operating system on it. %d is how many partitions go.
      n_("Deleting %d partition.", "Deleting %d partitions.", partitions),
      partitions,
    );
  }

  return null;
}

/** The same four cases as {@link deletion}, for what is made smaller instead. */
function shrinking(systems: string[], partitions: number): TranslatedString | null {
  if (systems.length > 2) {
    const others = systems.length - 1;
    return sprintf(
      // TRANSLATORS: What the installation makes room in, where more systems
      // are affected than the sentence names. %1$s is the name of an operating
      // system found on the disks, like "Windows 11"; %2$d is how many other
      // systems shrink with it.
      n_("Shrinking %1$s and %2$d other system.", "Shrinking %1$s and %2$d other systems.", others),
      systems[0],
      others,
    );
  }

  if (systems.length) {
    return sprintf(
      // TRANSLATORS: What the installation makes room in. %s is one or two
      // names of operating systems found on the disks, like "Windows 11" or
      // "Windows 11 and openSUSE Leap 15.2".
      _("Shrinking %s."),
      formatList(systems),
    );
  }

  if (partitions) {
    return sprintf(
      // TRANSLATORS: What the installation makes room in, where it recognizes
      // no operating system on it. %d is how many partitions shrink.
      n_("Shrinking %d partition.", "Shrinking %d partitions.", partitions),
      partitions,
    );
  }

  return null;
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
 * @fixme The way into the whole picture, "View all N needed actions", belongs
 *  on this line beside the statement. It arrives with the sheet it opens.
 */
export default function Consequences(): React.ReactNode {
  const system = useSystemDevices();
  const staging = useProposalDevices();
  const actions = useActions();
  const manager = new DevicesManager(system, staging, actions);

  const deleted = deletion(unique(manager.deletedSystems()), manager.deletedDevices().length);
  if (deleted) return <Text textStyle="textColorStatusDanger">{deleted}</Text>;

  /* A shrink loses no data: a partition survives, smaller. Coloring it would
     put it beside deletion, which is a different kind of news. */
  const shrunk = shrinking(unique(manager.resizedSystems()), manager.resizedDevices().length);
  if (shrunk) return <Text>{shrunk}</Text>;

  return null;
}
