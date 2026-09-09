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
import { sift, unique } from "radashi";
import DevicesManager from "~/model/storage/devices-manager";
import { _, n_, formatList, TranslatedString } from "~/i18n";
import type { Storage as System } from "~/model/system";

/** What an entry of the plan costs what is already on the machine. */
export type Consequence = {
  /** Whether anything is lost, which is what decides how loudly it is said. */
  kind: "destroys" | "shrinks";
  text: TranslatedString;
};

/**
 * Every phrase is written whole, one per case, rather than a verb joined to a
 * subject built somewhere else. A translator needs the finished sentence to
 * choose a verb form, and in several languages the subject changes case after
 * it.
 */
function deleted(systems: string[], count: number): TranslatedString {
  if (systems.length) {
    return sprintf(
      // TRANSLATORS: what an entry of the installation costs. %s is one or more
      // names of operating systems found on it, like "Windows 11".
      _("%s will be deleted"),
      formatList(systems),
    );
  }

  return sprintf(
    // TRANSLATORS: what an entry of the installation costs, where no operating
    // system is recognized on it. %d is how many partitions go.
    n_("%d partition will be deleted", "%d partitions will be deleted", count),
    count,
  );
}

/** The same two cases as {@link deleted}, for what keeps its data instead. */
function formatted(systems: string[], count: number): TranslatedString {
  if (systems.length) {
    return sprintf(
      // TRANSLATORS: what an entry of the installation costs. %s is one or more
      // names of operating systems found on it, like "Windows 11".
      _("%s will be formatted"),
      formatList(systems),
    );
  }

  return sprintf(
    // TRANSLATORS: what an entry of the installation costs, where no operating
    // system is recognized on it. %d is how many partitions are emptied.
    n_("%d partition will be formatted", "%d partitions will be formatted", count),
    count,
  );
}

/** No name here: a partition that shrinks keeps what is on it. */
function shrunk(count: number): TranslatedString {
  return sprintf(
    // TRANSLATORS: what an entry of the installation costs. %d is how many
    // partitions are made smaller to fit the new system in.
    n_("%d partition will shrink", "%d partitions will shrink", count),
    count,
  );
}

const systemsOf = (devices: System.Device[]): string[] =>
  unique(sift(devices.flatMap((device) => device.block?.systems || [])));

/**
 * What becomes of the things one entry of the plan already holds.
 *
 * Deleting, formatting and shrinking are three different pieces of news and
 * each keeps its own verb: a partition that is formatted survives and its data
 * does not, which is neither of the other two. They are ordered by what they
 * cost, so a row that both shrinks and deletes says the deletion first.
 *
 * Naming beats counting wherever the machine gives a name. "Windows 11 will be
 * deleted" is worth more to the reader than "1 partition will be deleted", and
 * the page has never said it about one device.
 *
 * @param parts - what the entry holds today: a disk's partitions, a volume
 *   group's logical volumes.
 */
function consequencesOf(manager: DevicesManager, parts: System.Device[]): Consequence[] {
  if (!parts.length) return [];

  const sids = new Set(parts.map((part) => part.sid));
  const mine = (devices: System.Device[]) => devices.filter((device) => sids.has(device.sid));

  const gone = mine(manager.deletedDevices());
  const smaller = mine(manager.resizedDevices());
  /* Emptied rather than removed: it survives the installation as a partition
     and loses everything that was on it, which the plan reports as no action of
     its own. */
  const emptied = parts.filter((part) => {
    if (sids.size === 0) return false;
    const staged = manager.stagingDevice(part.sid);
    return staged !== undefined && manager.hasNewFilesystem(staged);
  });

  return sift([
    gone.length && { kind: "destroys" as const, text: deleted(systemsOf(gone), gone.length) },
    emptied.length && {
      kind: "destroys" as const,
      text: formatted(systemsOf(emptied), emptied.length),
    },
    smaller.length && { kind: "shrinks" as const, text: shrunk(smaller.length) },
  ]);
}

export { consequencesOf };
