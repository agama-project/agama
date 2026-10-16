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
import { deviceSize } from "~/components/storage/utils";
import { _, n_, formatList } from "~/i18n";
import type { TranslatedString } from "~/i18n";
import type { Decision } from "~/components/storage/device-sheet/partition-space";

/** Something on the device today, as far as the summary needs to know it. */
export type ContentPart = {
  /** Short name, such as "vdd4". */
  name: string;
  /** Operating systems found on it. */
  systems: string[];
  /** Where the new system uses it, if it does. No space decision reaches it then. */
  reusedAs?: string;
  /** Whether the new system formats it, losing its data, rather than mounting it as it is. */
  formats?: boolean;
  /** How much shrinking it could free, if it can be shrunk. */
  recoverable?: number;
  /** What is allowed to happen to it, where the new system does not use it. */
  decision?: Decision;
};

export type ContentKind = "partitions" | "logicalVolumes";

/**
 * What becomes of a part. Shrinking allowed on a part that cannot be shrunk
 * keeps it: the table says why, the summary only what happens.
 */
type Outcome = "delete" | "format" | "shrink" | "keep" | "mount";

/** In the order they are said: what loses data first. */
const OUTCOMES: Outcome[] = ["delete", "format", "shrink", "keep", "mount"];

/**
 * Up to how many parts used by the new system are named by where they are
 * mounted. Past that they are counted, and the table names them.
 */
const MAX_LISTED_MOUNT_POINTS = 2;

function outcomeOf(part: ContentPart): Outcome {
  if (part.reusedAs !== undefined) return part.formats ? "format" : "mount";
  if (part.decision === "delete") return "delete";
  if (part.decision === "resizeIfNeeded" && part.recoverable !== undefined) return "shrink";
  return "keep";
}

/** One clause per way of saying how many: the only one, both, all, or some. */
type Forms = {
  it: TranslatedString;
  both: TranslatedString;
  all: TranslatedString;
  some: TranslatedString;
};

/**
 * The clause saying how many of the parts something happens to. The count
 * fills %d where the clause has one, and the detail fills %s.
 */
function clause(count: number, total: number, forms: Forms, detail?: string): TranslatedString {
  if (count < total) return sprintf(forms.some, count, detail);
  if (total === 1) return sprintf(forms.it, detail);
  if (total === 2) return sprintf(forms.both, detail);
  return sprintf(forms.all, detail);
}

function deleted(count: number, total: number, parts: ContentPart[]): TranslatedString {
  const systems = formatList(unique(parts.flatMap((part) => part.systems)));

  if (systems) {
    return clause(
      count,
      total,
      {
        // TRANSLATORS: follows "1 partition:" or "1 logical volume:" (must fit
        // both nouns). Removed, data lost. %s: operating systems found, such as
        // "Windows 11".
        it: _("it will be deleted (including %s)"),
        // TRANSLATORS: follows "2 partitions:" or "2 logical volumes:" (must
        // fit both nouns). Removed, data lost. %s: operating systems found,
        // such as "Windows 11".
        both: _("both will be deleted (including %s)"),
        // TRANSLATORS: follows "3 partitions:" or "3 logical volumes:", or more
        // (must fit both nouns). Removed, data lost. %s: operating systems
        // found, such as "Windows 11".
        all: _("all will be deleted (including %s)"),
        // TRANSLATORS: list item following "5 partitions:" or
        // "5 logical volumes:" (must fit both nouns). Removed, data lost. %1$d:
        // how many. %2$s: operating systems found, such as "Windows 11".
        some: n_(
          "%1$d will be deleted (including %2$s)",
          "%1$d will be deleted (including %2$s)",
          count,
        ),
      },
      systems,
    );
  }

  return clause(count, total, {
    // TRANSLATORS: follows "1 partition:" or "1 logical volume:" (must fit both
    // nouns). Removed, data lost.
    it: _("it will be deleted"),
    // TRANSLATORS: follows "2 partitions:" or "2 logical volumes:" (must fit
    // both nouns). Removed, data lost.
    both: _("both will be deleted"),
    // TRANSLATORS: follows "3 partitions:" or "3 logical volumes:", or more
    // (must fit both nouns). Removed, data lost.
    all: _("all will be deleted"),
    // TRANSLATORS: list item following "5 partitions:" or "5 logical volumes:"
    // (must fit both nouns). Removed, data lost. %d: how many.
    some: n_("%d will be deleted", "%d will be deleted", count),
  });
}

function shrunk(count: number, total: number, parts: ContentPart[]): TranslatedString {
  const freed = deviceSize(parts.reduce((sum, part) => sum + (part.recoverable || 0), 0));

  return clause(
    count,
    total,
    {
      // TRANSLATORS: follows "1 partition:" or "1 logical volume:" (must fit
      // both nouns). May be made smaller if room is needed; data kept. %s: most
      // space that can be freed, such as "30 GiB".
      it: _("it may be shrunk (up to %s)"),
      // TRANSLATORS: follows "2 partitions:" or "2 logical volumes:" (must fit
      // both nouns). May be made smaller if room is needed; data kept. %s: most
      // space that can be freed, such as "30 GiB".
      both: _("both may be shrunk (up to %s)"),
      // TRANSLATORS: follows "3 partitions:" or "3 logical volumes:", or more
      // (must fit both nouns). May be made smaller if room is needed; data
      // kept. %s: most space that can be freed, such as "30 GiB".
      all: _("all may be shrunk (up to %s)"),
      // TRANSLATORS: list item following "5 partitions:" or
      // "5 logical volumes:" (must fit both nouns). May be made smaller if room
      // is needed; data kept. %1$d: how many. %2$s: most space that can be
      // freed, such as "30 GiB".
      some: n_("%1$d may be shrunk (up to %2$s)", "%1$d may be shrunk (up to %2$s)", count),
    },
    freed,
  );
}

function kept(count: number, total: number): TranslatedString {
  return clause(count, total, {
    // TRANSLATORS: follows "1 partition:" or "1 logical volume:" (must fit both
    // nouns). Nothing changes.
    it: _("it will be kept"),
    // TRANSLATORS: follows "2 partitions:" or "2 logical volumes:" (must fit
    // both nouns). Nothing changes.
    both: _("both will be kept"),
    // TRANSLATORS: follows "3 partitions:" or "3 logical volumes:", or more
    // (must fit both nouns). Nothing changes.
    all: _("all will be kept"),
    // TRANSLATORS: list item following "5 partitions:" or "5 logical volumes:"
    // (must fit both nouns). Nothing changes. %d: how many.
    some: n_("%d will be kept", "%d will be kept", count),
  });
}

/** The clause saying how many of the parts something happens to, past naming them. */
function countedClause(count: number, total: number, forms: Omit<Forms, "it">): TranslatedString {
  if (count < total) return sprintf(forms.some, count);
  if (total === 2) return forms.both;
  return forms.all;
}

/** Named by where they are mounted while there are few of them. */
function formatted(count: number, total: number, parts: ContentPart[]): TranslatedString {
  if (count > MAX_LISTED_MOUNT_POINTS) {
    return countedClause(count, total, {
      // TRANSLATORS: follows "2 partitions:" or "2 logical volumes:" (must fit
      // both nouns). Given a new file system; data lost.
      both: _("both will be formatted for the new system"),
      // TRANSLATORS: follows "3 partitions:" or "3 logical volumes:", or more
      // (must fit both nouns). Given a new file system; data lost.
      all: _("all will be formatted for the new system"),
      // TRANSLATORS: list item following "5 partitions:" or
      // "5 logical volumes:" (must fit both nouns). Given a new file system;
      // data lost. %d: how many.
      some: n_(
        "%d will be formatted for the new system",
        "%d will be formatted for the new system",
        count,
      ),
    });
  }

  return clause(
    count,
    total,
    {
      // TRANSLATORS: follows "1 partition:" or "1 logical volume:" (must fit
      // both nouns). Given a new file system; data lost. %s: mount point, such
      // as "/home".
      it: _("it will be formatted for %s"),
      // TRANSLATORS: follows "2 partitions:" or "2 logical volumes:" (must fit
      // both nouns). Given a new file system; data lost. %s: mount points, such
      // as "/ and /home".
      both: _("both will be formatted, for %s"),
      // TRANSLATORS: follows "3 partitions:" or "3 logical volumes:", or more
      // (must fit both nouns). Given a new file system; data lost. %s: mount
      // points, such as "/, /home, and /srv".
      all: _("all will be formatted, for %s"),
      // TRANSLATORS: list item following "5 partitions:" or
      // "5 logical volumes:" (must fit both nouns). Given a new file system;
      // data lost. %1$d: how many. %2$s: mount points, such as "/home".
      some: n_("%1$d will be formatted for %2$s", "%1$d will be formatted, for %2$s", count),
    },
    formatList(parts.map((part) => part.reusedAs)),
  );
}

/** Named by where they are mounted while there are few of them. */
function mounted(count: number, total: number, parts: ContentPart[]): TranslatedString {
  if (count > MAX_LISTED_MOUNT_POINTS) {
    return countedClause(count, total, {
      // TRANSLATORS: follows "2 partitions:" or "2 logical volumes:" (must fit
      // both nouns). Used by the new system unchanged; data kept.
      both: _("both will be mounted as they are"),
      // TRANSLATORS: follows "3 partitions:" or "3 logical volumes:", or more
      // (must fit both nouns). Used by the new system unchanged; data kept.
      all: _("all will be mounted as they are"),
      // TRANSLATORS: list item following "5 partitions:" or
      // "5 logical volumes:" (must fit both nouns). Used by the new system
      // unchanged; data kept. %d: how many.
      some: n_("%d will be mounted as it is", "%d will be mounted as they are", count),
    });
  }

  return clause(
    count,
    total,
    {
      // TRANSLATORS: follows "1 partition:" or "1 logical volume:" (must fit
      // both nouns). Used by the new system unchanged; data kept. %s: mount
      // point, such as "/home".
      it: _("it will be mounted at %s"),
      // TRANSLATORS: follows "2 partitions:" or "2 logical volumes:" (must fit
      // both nouns). Used by the new system unchanged; data kept. %s: mount
      // points, such as "/ and /home".
      both: _("both will be mounted, at %s"),
      // TRANSLATORS: follows "3 partitions:" or "3 logical volumes:", or more
      // (must fit both nouns). Used by the new system unchanged; data kept. %s:
      // mount points, such as "/, /home, and /srv".
      all: _("all will be mounted, at %s"),
      // TRANSLATORS: list item following "5 partitions:" or
      // "5 logical volumes:" (must fit both nouns). Used by the new system
      // unchanged; data kept. %1$d: how many. %2$s: mount points, such as
      // "/home".
      some: n_("%1$d will be mounted at %2$s", "%1$d will be mounted, at %2$s", count),
    },
    formatList(parts.map((part) => part.reusedAs)),
  );
}

function said(outcome: Outcome, parts: ContentPart[], total: number): TranslatedString | undefined {
  const count = parts.length;
  if (!count) return undefined;

  switch (outcome) {
    case "delete":
      return deleted(count, total, parts);
    case "shrink":
      return shrunk(count, total, parts);
    case "keep":
      return kept(count, total);
    case "format":
      return formatted(count, total, parts);
    case "mount":
      return mounted(count, total, parts);
  }
}

/** The two halves of the summary: how much there is, and what becomes of it. */
export type SummaryParts = {
  /** How many parts there are, such as "3 partitions". */
  amount: TranslatedString;
  /** How many of them meet each fate, such as "1 will be deleted and 2 will be kept". */
  fates: TranslatedString;
};

/** The sentence joining the two halves, with %1$s the amount and %2$s the fates. */
export function summarySentence(): TranslatedString {
  // TRANSLATORS: summary of what is on a disk or volume group. %1$s: how much,
  // in bold, such as "3 partitions". %2$s: what happens to it, such as
  // "1 will be deleted and 2 will be kept". Adapt the colon to your language.
  return _("%1$s: %2$s");
}

/**
 * The halves of the summary, for showing how much there is apart from the
 * rest, such as in bold. Nothing when the device holds nothing.
 */
export function summaryParts(kind: ContentKind, parts: ContentPart[]): SummaryParts | undefined {
  const total = parts.length;
  if (!total) return undefined;

  const fates = formatList(
    sift(
      OUTCOMES.map((outcome) =>
        said(
          outcome,
          parts.filter((part) => outcomeOf(part) === outcome),
          total,
        ),
      ),
    ),
  );

  const amount = sprintf(
    kind === "partitions"
      ? // TRANSLATORS: how many partitions a disk holds, shown in bold before
        // the colon of its summary.
        n_("%d partition", "%d partitions", total)
      : // TRANSLATORS: how many logical volumes a volume group holds, shown in
        // bold before the colon of its summary.
        n_("%d logical volume", "%d logical volumes", total),
    total,
  );

  return { amount, fates };
}

/**
 * One sentence saying what is on a device and what happens to it: how many
 * parts there are, then how many of them meet each fate.
 *
 * Each fate is a clause of its own, so translators get whole clauses rather
 * than pieces of one. "It", "both" and "all" say when one fate covers every
 * part.
 *
 * @example
 * contentSummary("partitions", parts)
 * // "5 partitions: 3 will be deleted, 1 may be shrunk (up to 30 GiB), and 1 will be mounted at /home"
 * // "3 partitions: all will be kept"
 */
export default function contentSummary(
  kind: ContentKind,
  parts: ContentPart[],
): TranslatedString | undefined {
  const halves = summaryParts(kind, parts);
  if (!halves) return undefined;

  return sprintf(summarySentence(), halves.amount, halves.fates);
}
