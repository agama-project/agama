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
import { n_ } from "~/i18n";
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
 * The sentence for the case: which outcomes happen, and whether one covers
 * every part. Each case is a whole sentence for translators, rather than
 * clauses joined in code.
 */
function mainSentence(kind: ContentKind, counts: Counts): TranslatedString {
  const { total, deleted: d, formatted: f, shrunk: s, mounted: m } = counts;
  const isLV = kind === "logicalVolumes";

  /* Nothing happens to any of them. */
  if (!d && !f && !s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: %1$d is how many there are.
          // Keep the brackets, which mark bold text.
          n_(
            "[%1$d logical volume]: it will be kept.",
            "[%1$d logical volumes]: all will be kept.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are.
          // Keep the brackets, which mark bold text.
          n_("[%1$d partition]: it will be kept.", "[%1$d partitions]: all will be kept.", total),
      counts,
    );
  }

  /* One outcome only, and the rest kept. */
  if (d && !f && !s && !m) {
    if (d === total) {
      return filled(
        isLV
          ? // TRANSLATORS: %1$d is how many there are.
            // Keep the brackets, which mark bold text.
            n_(
              "[%1$d logical volume]: it will be deleted.",
              "[%1$d logical volumes]: all will be deleted.",
              total,
            )
          : // TRANSLATORS: %1$d is how many there are.
            // Keep the brackets, which mark bold text.
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
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted.
          // Keep the brackets, which mark bold text.
          n_(
            "[%1$d logical volume]: %2$d will be deleted.",
            "[%1$d logical volumes]: %2$d will be deleted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted.
          // Keep the brackets, which mark bold text.
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
          ? // TRANSLATORS: %1$d is how many there are.
            // Keep the brackets, which mark bold text.
            n_(
              "[%1$d logical volume]: it will be formatted.",
              "[%1$d logical volumes]: all will be formatted.",
              total,
            )
          : // TRANSLATORS: %1$d is how many there are.
            // Keep the brackets, which mark bold text.
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
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be formatted.
          // Keep the brackets, which mark bold text.
          n_(
            "[%1$d logical volume]: %2$d will be formatted.",
            "[%1$d logical volumes]: %2$d will be formatted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be formatted.
          // Keep the brackets, which mark bold text.
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
          ? // TRANSLATORS: %1$d is how many there are.
            // Keep the brackets, which mark bold text.
            n_(
              "[%1$d logical volume]: it may be shrunk.",
              "[%1$d logical volumes]: all may be shrunk.",
              total,
            )
          : // TRANSLATORS: %1$d is how many there are.
            // Keep the brackets, which mark bold text.
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
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many may be shrunk.
          // Keep the brackets, which mark bold text.
          n_(
            "[%1$d logical volume]: %2$d may be shrunk.",
            "[%1$d logical volumes]: %2$d may be shrunk.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many may be shrunk.
          // Keep the brackets, which mark bold text.
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
          ? // TRANSLATORS: %1$d is how many there are.
            // Keep the brackets, which mark bold text.
            // "Mounted" means used as is, keeping its data.
            n_(
              "[%1$d logical volume]: it will be mounted.",
              "[%1$d logical volumes]: all will be mounted.",
              total,
            )
          : // TRANSLATORS: %1$d is how many there are.
            // Keep the brackets, which mark bold text.
            // "Mounted" means used as is, keeping its data.
            n_(
              "[%1$d partition]: it will be mounted.",
              "[%1$d partitions]: all will be mounted.",
              total,
            ),
        counts,
      );
    }

    return filled(
      isLV
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d logical volume]: %2$d will be mounted.",
            "[%1$d logical volumes]: %2$d will be mounted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d partition]: %2$d will be mounted.",
            "[%1$d partitions]: %2$d will be mounted.",
            total,
          ),
      counts,
    );
  }

  /* Two outcomes. The counts follow in the order the outcomes are said. */
  if (d && f && !s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // will be formatted.
          // Keep the brackets, which mark bold text.
          n_(
            "[%1$d logical volume]: %2$d will be deleted and %3$d will be formatted.",
            "[%1$d logical volumes]: %2$d will be deleted and %3$d will be formatted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // will be formatted.
          // Keep the brackets, which mark bold text.
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
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // may be shrunk.
          // Keep the brackets, which mark bold text.
          n_(
            "[%1$d logical volume]: %2$d will be deleted and %3$d may be shrunk.",
            "[%1$d logical volumes]: %2$d will be deleted and %3$d may be shrunk.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // may be shrunk.
          // Keep the brackets, which mark bold text.
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
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d logical volume]: %2$d will be deleted and %3$d will be mounted.",
            "[%1$d logical volumes]: %2$d will be deleted and %3$d will be mounted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d partition]: %2$d will be deleted and %3$d will be mounted.",
            "[%1$d partitions]: %2$d will be deleted and %3$d will be mounted.",
            total,
          ),
      counts,
    );
  }

  if (!d && f && s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be formatted, %3$d how many
          // may be shrunk.
          // Keep the brackets, which mark bold text.
          n_(
            "[%1$d logical volume]: %2$d will be formatted and %3$d may be shrunk.",
            "[%1$d logical volumes]: %2$d will be formatted and %3$d may be shrunk.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be formatted, %3$d how many
          // may be shrunk.
          // Keep the brackets, which mark bold text.
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
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be formatted, %3$d how many
          // will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d logical volume]: %2$d will be formatted and %3$d will be mounted.",
            "[%1$d logical volumes]: %2$d will be formatted and %3$d will be mounted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be formatted, %3$d how many
          // will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d partition]: %2$d will be formatted and %3$d will be mounted.",
            "[%1$d partitions]: %2$d will be formatted and %3$d will be mounted.",
            total,
          ),
      counts,
    );
  }

  if (!d && !f && s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many may be shrunk, %3$d how many
          // will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d logical volume]: %2$d may be shrunk and %3$d will be mounted.",
            "[%1$d logical volumes]: %2$d may be shrunk and %3$d will be mounted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many may be shrunk, %3$d how many
          // will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d partition]: %2$d may be shrunk and %3$d will be mounted.",
            "[%1$d partitions]: %2$d may be shrunk and %3$d will be mounted.",
            total,
          ),
      counts,
    );
  }

  /* Three outcomes. */
  if (d && f && s && !m) {
    return filled(
      isLV
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // will be formatted, %4$d how many may be shrunk.
          // Keep the brackets, which mark bold text.
          n_(
            "[%1$d logical volume]: %2$d will be deleted, %3$d will be formatted and %4$d may be shrunk.",
            "[%1$d logical volumes]: %2$d will be deleted, %3$d will be formatted and %4$d may be shrunk.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // will be formatted, %4$d how many may be shrunk.
          // Keep the brackets, which mark bold text.
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
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // will be formatted, %4$d how many will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d logical volume]: %2$d will be deleted, %3$d will be formatted and %4$d will be mounted.",
            "[%1$d logical volumes]: %2$d will be deleted, %3$d will be formatted and %4$d will be mounted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // will be formatted, %4$d how many will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d partition]: %2$d will be deleted, %3$d will be formatted and %4$d will be mounted.",
            "[%1$d partitions]: %2$d will be deleted, %3$d will be formatted and %4$d will be mounted.",
            total,
          ),
      counts,
    );
  }

  if (d && !f && s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // may be shrunk, %4$d how many will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d logical volume]: %2$d will be deleted, %3$d may be shrunk and %4$d will be mounted.",
            "[%1$d logical volumes]: %2$d will be deleted, %3$d may be shrunk and %4$d will be mounted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
          // may be shrunk, %4$d how many will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d partition]: %2$d will be deleted, %3$d may be shrunk and %4$d will be mounted.",
            "[%1$d partitions]: %2$d will be deleted, %3$d may be shrunk and %4$d will be mounted.",
            total,
          ),
      counts,
    );
  }

  if (!d && f && s && m) {
    return filled(
      isLV
        ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be formatted, %3$d how many
          // may be shrunk, %4$d how many will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d logical volume]: %2$d will be formatted, %3$d may be shrunk and %4$d will be mounted.",
            "[%1$d logical volumes]: %2$d will be formatted, %3$d may be shrunk and %4$d will be mounted.",
            total,
          )
        : // TRANSLATORS: %1$d is how many there are, %2$d how many will be formatted, %3$d how many
          // may be shrunk, %4$d how many will be mounted.
          // Keep the brackets, which mark bold text.
          // "Mounted" means used as is, keeping its data.
          n_(
            "[%1$d partition]: %2$d will be formatted, %3$d may be shrunk and %4$d will be mounted.",
            "[%1$d partitions]: %2$d will be formatted, %3$d may be shrunk and %4$d will be mounted.",
            total,
          ),
      counts,
    );
  }

  /* All four outcomes. */
  return filled(
    isLV
      ? // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
        // will be formatted, %4$d how many may be shrunk, %5$d how many will be mounted.
        // Keep the brackets, which mark bold text.
        // "Mounted" means used as is, keeping its data.
        n_(
          "[%1$d logical volume]: %2$d will be deleted, %3$d will be formatted, %4$d may be shrunk and %5$d will be mounted.",
          "[%1$d logical volumes]: %2$d will be deleted, %3$d will be formatted, %4$d may be shrunk and %5$d will be mounted.",
          total,
        )
      : // TRANSLATORS: %1$d is how many there are, %2$d how many will be deleted, %3$d how many
        // will be formatted, %4$d how many may be shrunk, %5$d how many will be mounted.
        // Keep the brackets, which mark bold text.
        // "Mounted" means used as is, keeping its data.
        n_(
          "[%1$d partition]: %2$d will be deleted, %3$d will be formatted, %4$d may be shrunk and %5$d will be mounted.",
          "[%1$d partitions]: %2$d will be deleted, %3$d will be formatted, %4$d may be shrunk and %5$d will be mounted.",
          total,
        ),
    counts,
  );
}

export type CurrentContentSummary = {
  /**
   * The amount goes between brackets, to be shown in bold, as in
   * "[3 partitions]: all will be deleted.".
   */
  sentence: TranslatedString;
};

/**
 * One sentence saying what is on a device today and what the installation does
 * to it. Kept parts count in the total but are only mentioned when all of them
 * are kept. Undefined when the device holds nothing.
 *
 * @example
 * buildCurrentContentSummary({ kind: "partitions", parts })
 * // { sentence: "[4 partitions]: 2 will be deleted and 1 will be formatted." }
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

  return { sentence: mainSentence(kind, counts) };
}
