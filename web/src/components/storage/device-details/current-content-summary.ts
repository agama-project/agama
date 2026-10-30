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
import { _, n_, formatList } from "~/i18n";
import { markerText } from "~/components/core/Interpolate";
import type { TranslatedString } from "~/i18n";
import type { Decision } from "~/components/storage/device-details/partition-space";

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

function outcomeOf(part: ContentPart): Outcome {
  if (part.reusedAs !== undefined) return part.formats ? "format" : "mount";
  if (part.decision === "delete") return "delete";
  if (part.decision === "resizeIfNeeded" && part.recoverable !== undefined) return "shrink";
  return "keep";
}

/** How many parts there are, and how many meet each outcome that is said. */
type Counts = {
  total: number;
  deleted: number;
  formatted: number;
  shrunk: number;
  mounted: number;
};

/**
 * The sentence for one case, with its counts filled in. `%1$d` is always the
 * total, which picks the singular or the plural form; the other counts follow
 * in the order the outcomes are said: deleted, formatted, shrunk, mounted.
 */
function filled(
  sentence: TranslatedString,
  { total, deleted, formatted, shrunk, mounted }: Counts,
) {
  const counts = [deleted, formatted, shrunk, mounted].filter((count) => count > 0);
  return sprintf(sentence, total, ...counts);
}

/**
 * The main sentence, one per case: which outcomes are said, and whether one of
 * them covers every part. What is kept is said only when everything is.
 *
 * Each case is a whole sentence for translators, rather than clauses joined by
 * the code. The amount is marked between brackets, to be shown in bold.
 */
function mainSentence(kind: ContentKind, counts: Counts): TranslatedString {
  const { total, deleted: d, formatted: f, shrunk: s, mounted: m } = counts;
  const isLV = kind === "logicalVolumes";

  /* Nothing happens to any of them. */
  if (!d && !f && !s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of what happens to the logical volumes a volume
          // group holds: nothing. %1$d is how many there are; keep the brackets,
          // which mark the part shown in bold.
          n_(
            "[%1$d logical volume]: it will be kept.",
            "[%1$d logical volumes]: all will be kept.",
            total,
          )
        : // TRANSLATORS: summary of what happens to the partitions a disk holds:
          // nothing. %1$d is how many there are; keep the brackets, which mark
          // the part shown in bold.
          n_("[%1$d partition]: it will be kept.", "[%1$d partitions]: all will be kept.", total),
      counts,
    );
  }

  /* One outcome only, and the rest kept. */
  if (d && !f && !s && !m) {
    if (d === total) {
      return filled(
        isLV
          ? // TRANSLATORS: summary: every logical volume of a volume group is
            // deleted, its data lost. %1$d is how many there are; keep the
            // brackets.
            n_(
              "[%1$d logical volume]: it will be deleted.",
              "[%1$d logical volumes]: all will be deleted.",
              total,
            )
          : // TRANSLATORS: summary: every partition of a disk is deleted, its
            // data lost. %1$d is how many there are; keep the brackets.
            n_(
              "[%1$d partition]: it will be deleted.",
              "[%1$d partitions]: all will be deleted.",
              total,
            ),
        counts,
      );
    }

    return filled(
      isLV
        ? // TRANSLATORS: summary: some logical volumes are deleted, the rest
          // kept. %1$d is how many there are, %2$d how many are deleted; keep
          // the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be deleted.",
            "[%1$d logical volumes]: %2$d will be deleted.",
            total,
          )
        : // TRANSLATORS: summary: some partitions are deleted, the rest kept.
          // %1$d is how many there are, %2$d how many are deleted; keep the
          // brackets.
          n_(
            "[%1$d partition]: %2$d will be deleted.",
            "[%1$d partitions]: %2$d will be deleted.",
            total,
          ),
      counts,
    );
  }

  if (!d && f && !s && !m) {
    if (f === total) {
      return filled(
        isLV
          ? // TRANSLATORS: summary: every logical volume is given a new file
            // system for the new system, its data lost. %1$d is how many there
            // are; keep the brackets.
            n_(
              "[%1$d logical volume]: it will be formatted.",
              "[%1$d logical volumes]: all will be formatted.",
              total,
            )
          : // TRANSLATORS: summary: every partition is given a new file system
            // for the new system, its data lost. %1$d is how many there are;
            // keep the brackets.
            n_(
              "[%1$d partition]: it will be formatted.",
              "[%1$d partitions]: all will be formatted.",
              total,
            ),
        counts,
      );
    }

    return filled(
      isLV
        ? // TRANSLATORS: summary: some logical volumes are given a new file
          // system, the rest kept. %1$d is how many there are, %2$d how many are
          // formatted; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be formatted.",
            "[%1$d logical volumes]: %2$d will be formatted.",
            total,
          )
        : // TRANSLATORS: summary: some partitions are given a new file system,
          // the rest kept. %1$d is how many there are, %2$d how many are
          // formatted; keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be formatted.",
            "[%1$d partitions]: %2$d will be formatted.",
            total,
          ),
      counts,
    );
  }

  if (!d && !f && s && !m) {
    if (s === total) {
      return filled(
        isLV
          ? // TRANSLATORS: summary: every logical volume may be made smaller if
            // room is needed, its data kept. %1$d is how many there are; keep
            // the brackets.
            n_(
              "[%1$d logical volume]: it may be shrunk.",
              "[%1$d logical volumes]: all may be shrunk.",
              total,
            )
          : // TRANSLATORS: summary: every partition may be made smaller if room
            // is needed, its data kept. %1$d is how many there are; keep the
            // brackets.
            n_(
              "[%1$d partition]: it may be shrunk.",
              "[%1$d partitions]: all may be shrunk.",
              total,
            ),
        counts,
      );
    }

    return filled(
      isLV
        ? // TRANSLATORS: summary: some logical volumes may be made smaller, the
          // rest kept. %1$d is how many there are, %2$d how many may be
          // shrunk; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d may be shrunk.",
            "[%1$d logical volumes]: %2$d may be shrunk.",
            total,
          )
        : // TRANSLATORS: summary: some partitions may be made smaller, the rest
          // kept. %1$d is how many there are, %2$d how many may be shrunk; keep
          // the brackets.
          n_(
            "[%1$d partition]: %2$d may be shrunk.",
            "[%1$d partitions]: %2$d may be shrunk.",
            total,
          ),
      counts,
    );
  }

  if (!d && !f && !s && m) {
    if (m === total) {
      return filled(
        isLV
          ? // TRANSLATORS: summary: every logical volume is used by the new
            // system unchanged, its data kept. %1$d is how many there are; keep
            // the brackets.
            n_(
              "[%1$d logical volume]: it will be mounted unchanged.",
              "[%1$d logical volumes]: all will be mounted unchanged.",
              total,
            )
          : // TRANSLATORS: summary: every partition is used by the new system
            // unchanged, its data kept. %1$d is how many there are; keep the
            // brackets.
            n_(
              "[%1$d partition]: it will be mounted unchanged.",
              "[%1$d partitions]: all will be mounted unchanged.",
              total,
            ),
        counts,
      );
    }

    return filled(
      isLV
        ? // TRANSLATORS: summary: some logical volumes are used by the new
          // system unchanged, the rest kept. %1$d is how many there are, %2$d
          // how many are mounted; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be mounted unchanged.",
            "[%1$d logical volumes]: %2$d will be mounted unchanged.",
            total,
          )
        : // TRANSLATORS: summary: some partitions are used by the new system
          // unchanged, the rest kept. %1$d is how many there are, %2$d how many
          // are mounted; keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be mounted unchanged.",
            "[%1$d partitions]: %2$d will be mounted unchanged.",
            total,
          ),
      counts,
    );
  }

  /* Two outcomes. The counts follow in the order the outcomes are said. */
  if (d && f && !s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are deleted and how many
          // formatted; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be deleted and %3$d will be formatted.",
            "[%1$d logical volumes]: %2$d will be deleted and %3$d will be formatted.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are deleted and how many formatted; keep
          // the brackets.
          n_(
            "[%1$d partition]: %2$d will be deleted and %3$d will be formatted.",
            "[%1$d partitions]: %2$d will be deleted and %3$d will be formatted.",
            total,
          ),
      counts,
    );
  }

  if (d && !f && s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are deleted and how many may be
          // shrunk; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be deleted and %3$d may be shrunk.",
            "[%1$d logical volumes]: %2$d will be deleted and %3$d may be shrunk.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are deleted and how many may be shrunk;
          // keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be deleted and %3$d may be shrunk.",
            "[%1$d partitions]: %2$d will be deleted and %3$d may be shrunk.",
            total,
          ),
      counts,
    );
  }

  if (d && !f && !s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are deleted and how many used
          // unchanged; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be deleted and %3$d will be mounted unchanged.",
            "[%1$d logical volumes]: %2$d will be deleted and %3$d will be mounted unchanged.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are deleted and how many used unchanged;
          // keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be deleted and %3$d will be mounted unchanged.",
            "[%1$d partitions]: %2$d will be deleted and %3$d will be mounted unchanged.",
            total,
          ),
      counts,
    );
  }

  if (!d && f && s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are formatted and how many may
          // be shrunk; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be formatted and %3$d may be shrunk.",
            "[%1$d logical volumes]: %2$d will be formatted and %3$d may be shrunk.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are formatted and how many may be shrunk;
          // keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be formatted and %3$d may be shrunk.",
            "[%1$d partitions]: %2$d will be formatted and %3$d may be shrunk.",
            total,
          ),
      counts,
    );
  }

  if (!d && f && !s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are formatted and how many used
          // unchanged; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be formatted and %3$d will be mounted unchanged.",
            "[%1$d logical volumes]: %2$d will be formatted and %3$d will be mounted unchanged.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are formatted and how many used unchanged;
          // keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be formatted and %3$d will be mounted unchanged.",
            "[%1$d partitions]: %2$d will be formatted and %3$d will be mounted unchanged.",
            total,
          ),
      counts,
    );
  }

  if (!d && !f && s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many may be shrunk and how many are
          // used unchanged; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d may be shrunk and %3$d will be mounted unchanged.",
            "[%1$d logical volumes]: %2$d may be shrunk and %3$d will be mounted unchanged.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many may be shrunk and how many are used
          // unchanged; keep the brackets.
          n_(
            "[%1$d partition]: %2$d may be shrunk and %3$d will be mounted unchanged.",
            "[%1$d partitions]: %2$d may be shrunk and %3$d will be mounted unchanged.",
            total,
          ),
      counts,
    );
  }

  /* Three outcomes. */
  if (d && f && s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are deleted, formatted and
          // may be shrunk; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be deleted, %3$d will be formatted and %4$d may be shrunk.",
            "[%1$d logical volumes]: %2$d will be deleted, %3$d will be formatted and %4$d may be shrunk.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are deleted, formatted and may be shrunk;
          // keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be deleted, %3$d will be formatted and %4$d may be shrunk.",
            "[%1$d partitions]: %2$d will be deleted, %3$d will be formatted and %4$d may be shrunk.",
            total,
          ),
      counts,
    );
  }

  if (d && f && !s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are deleted, formatted and
          // used unchanged; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be deleted, %3$d will be formatted and %4$d will be mounted unchanged.",
            "[%1$d logical volumes]: %2$d will be deleted, %3$d will be formatted and %4$d will be mounted unchanged.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are deleted, formatted and used unchanged;
          // keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be deleted, %3$d will be formatted and %4$d will be mounted unchanged.",
            "[%1$d partitions]: %2$d will be deleted, %3$d will be formatted and %4$d will be mounted unchanged.",
            total,
          ),
      counts,
    );
  }

  if (d && !f && s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are deleted, may be shrunk and
          // are used unchanged; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be deleted, %3$d may be shrunk and %4$d will be mounted unchanged.",
            "[%1$d logical volumes]: %2$d will be deleted, %3$d may be shrunk and %4$d will be mounted unchanged.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are deleted, may be shrunk and are used
          // unchanged; keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be deleted, %3$d may be shrunk and %4$d will be mounted unchanged.",
            "[%1$d partitions]: %2$d will be deleted, %3$d may be shrunk and %4$d will be mounted unchanged.",
            total,
          ),
      counts,
    );
  }

  if (!d && f && s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d
          // is how many there are, then how many are formatted, may be shrunk
          // and are used unchanged; keep the brackets.
          n_(
            "[%1$d logical volume]: %2$d will be formatted, %3$d may be shrunk and %4$d will be mounted unchanged.",
            "[%1$d logical volumes]: %2$d will be formatted, %3$d may be shrunk and %4$d will be mounted unchanged.",
            total,
          )
        : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
          // there are, then how many are formatted, may be shrunk and are used
          // unchanged; keep the brackets.
          n_(
            "[%1$d partition]: %2$d will be formatted, %3$d may be shrunk and %4$d will be mounted unchanged.",
            "[%1$d partitions]: %2$d will be formatted, %3$d may be shrunk and %4$d will be mounted unchanged.",
            total,
          ),
      counts,
    );
  }

  /* All four outcomes. */
  return filled(
    isLV
      ? // TRANSLATORS: summary of the logical volumes of a volume group. %1$d is
        // how many there are, then how many are deleted, formatted, may be
        // shrunk and are used unchanged; keep the brackets.
        n_(
          "[%1$d logical volume]: %2$d will be deleted, %3$d will be formatted, %4$d may be shrunk and %5$d will be mounted unchanged.",
          "[%1$d logical volumes]: %2$d will be deleted, %3$d will be formatted, %4$d may be shrunk and %5$d will be mounted unchanged.",
          total,
        )
      : // TRANSLATORS: summary of the partitions of a disk. %1$d is how many
        // there are, then how many are deleted, formatted, may be shrunk and
        // are used unchanged; keep the brackets.
        n_(
          "[%1$d partition]: %2$d will be deleted, %3$d will be formatted, %4$d may be shrunk and %5$d will be mounted unchanged.",
          "[%1$d partitions]: %2$d will be deleted, %3$d will be formatted, %4$d may be shrunk and %5$d will be mounted unchanged.",
          total,
        ),
    counts,
  );
}

/**
 * The sentences after the main one: the systems deleting loses, then where
 * the formatted and the unchanged parts are mounted, every one named.
 */
function detailSentences(parts: ContentPart[]): TranslatedString[] {
  const withOutcome = (outcome: Outcome) => parts.filter((part) => outcomeOf(part) === outcome);
  const lost = unique(withOutcome("delete").flatMap((part) => part.systems));
  const formatted = withOutcome("format").map((part) => part.reusedAs);
  const mounted = withOutcome("mount").map((part) => part.reusedAs);
  const sentences: TranslatedString[] = [];

  if (lost.length) {
    sentences.push(
      sprintf(
        // TRANSLATORS: follows the summary of a disk or volume group when what
        // is deleted holds operating systems. %s is their names, such as
        // "Windows 11" or "Windows 11 and openSUSE".
        n_("%s will be lost.", "%s will be lost.", lost.length),
        formatList(lost),
      ),
    );
  }

  if (formatted.length) {
    sentences.push(
      sprintf(
        // TRANSLATORS: follows the summary of a disk or volume group: where the
        // new system mounts what is formatted. %s is mount points, such as
        // "/home" or "/home and /srv".
        n_("%s will be formatted.", "%s will be formatted.", formatted.length),
        formatList(formatted),
      ),
    );
  }

  if (mounted.length) {
    sentences.push(
      sprintf(
        // TRANSLATORS: follows the summary of a disk or volume group: where the
        // new system mounts what it uses unchanged. %s is mount points, such as
        // "/home" or "/home and /srv".
        n_("%s will be mounted unchanged.", "%s will be mounted unchanged.", mounted.length),
        formatList(mounted),
      ),
    );
  }

  return sentences;
}

export type CurrentContentSummary = {
  /**
   * What is on the device and what happens to it, in one sentence. The amount
   * is marked between brackets, such as "[3 partitions]: all will be
   * deleted.", for showing it in bold.
   */
  sentence: TranslatedString;
  /** What there is more to say, a sentence each: systems lost, mount points. */
  details: TranslatedString[];
};

/**
 * What is on a device today and what the installation does to it, as whole
 * sentences: one per case for the main sentence, then one per detail.
 *
 * The case is which outcomes there are (deleted, formatted, may be shrunk,
 * mounted unchanged) and whether one covers every part. What is kept is said
 * only when everything is, so the sentence may count more parts than its
 * outcomes cover: the rest are kept, and the table lists them.
 *
 * Nothing when the device holds nothing.
 *
 * @example
 * buildCurrentContentSummary({ kind: "partitions", parts })
 * // {
 * //   sentence: "[4 partitions]: 2 will be deleted and 1 will be formatted.",
 * //   details: ["Windows 11 will be lost.", "/docs will be formatted."],
 * // }
 */
export function buildCurrentContentSummary({
  kind,
  parts,
}: {
  kind: ContentKind;
  parts: ContentPart[];
}): CurrentContentSummary | undefined {
  if (!parts.length) return undefined;

  const count = (outcome: Outcome) => parts.filter((part) => outcomeOf(part) === outcome).length;
  const counts: Counts = {
    total: parts.length,
    deleted: count("delete"),
    formatted: count("format"),
    shrunk: count("shrink"),
    mounted: count("mount"),
  };

  return { sentence: mainSentence(kind, counts), details: detailSentences(parts) };
}

/**
 * What goes between two sentences that follow each other, as the language
 * writes it: a space in most languages, nothing in some, such as Chinese or
 * Japanese.
 */
export function sentenceGap(): string {
  // TRANSLATORS: two sentences that follow each other in one paragraph, %1$s
  // the first and %2$s the second. Keep the space between them if your
  // language separates sentences with one, and leave it out if it does not.
  return sprintf(_("%1$s %2$s"), "", "");
}

/**
 * The summary as plain text, such as for announcing it: the main sentence as
 * it reads once rendered, then the details, each sentence after the other as
 * the language writes them.
 */
export function summaryText({ sentence, details }: CurrentContentSummary): TranslatedString {
  /* Every piece is translated already: this only puts them side by side. */
  return [markerText(sentence), ...details].join(sentenceGap()) as TranslatedString;
}
