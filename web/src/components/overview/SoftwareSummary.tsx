/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { isEmpty } from "radashi";
import xbytes from "xbytes";
import { sprintf } from "sprintf-js";

import Summary from "~/components/core/Summary";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import { useProposal } from "~/hooks/model/proposal/software";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { useIsDesktopMissing, useSelectedPatterns } from "~/hooks/model/system/software";
import { useIssues } from "~/hooks/model/issue";
import { SOFTWARE } from "~/routes/paths";
import { _, n_ } from "~/i18n";

/**
 * Formats the pattern-count line used as the headline when the user picked
 * non-desktop patterns on a product without desktop context, e.g.
 *   "Using 1 additional pattern"
 *   "Using 3 additional patterns"
 */
const patternsCount = (qty: number): string =>
  sprintf(
    // TRANSLATORS: count of patterns picked on top of the default selection.
    // %d is a number.
    n_("Using %d additional pattern", "Using %d additional patterns", qty),
    qty,
  );

/**
 * Renders the headline text for the software summary.
 *
 * Priority order:
 *   1. "No desktop selected" hint when the product suggests one, desktops are
 *      available, but none is selected.
 *   2. The selected desktop's summary when exactly one is selected.
 *   3. "N desktops selected" when more than one desktop is selected.
 *   4. "Using N additional patterns" when the user picked non-desktop
 *      patterns on a product not suggesting a desktop.
 *   5. "Default selection" when nothing is selected.
 */
const Value = () => {
  const patterns = useSelectedPatterns();
  const isDesktopMissing = useIsDesktopMissing();
  const desktops = patterns.filter((p) => p.desktop);

  if (isDesktopMissing) {
    // TRANSLATORS: shown in the software summary when no desktop is selected.
    return <Text isBold>{_("No desktop selected")}</Text>;
  }

  if (desktops.length === 1) {
    return <Text>{desktops[0].summary}</Text>;
  }

  if (desktops.length > 1) {
    // NOTE: n_() is needed even though desktops.length > 1 because some
    // languages have multiple plural forms (e.g., Russian: 2-4 vs 5+).
    //
    // TRANSLATORS: shown in the software summary when multiple desktops are
    // selected. %d is the number of desktops.
    return (
      <Text>
        {sprintf(
          n_("%d desktop selected", "%d desktops selected", desktops.length),
          desktops.length,
        )}
      </Text>
    );
  }

  if (patterns.length === 0) {
    // TRANSLATORS: shown in the software summary when the user hasn't picked
    // anything on top of the product's default selection.
    return <Text>{_("Default selection")}</Text>;
  }

  return <Text>{patternsCount(patterns.length)}</Text>;
};

/**
 * Renders the description of the software summary.
 *
 * When the headline is a desktop or the missing-desktop hint, the description
 * combines the pattern count (if any) with the required install size in a
 * single translatable sentence so translators can adjust punctuation and
 * order. When the headline already conveys the count, only the required
 * size is shown.
 *
 * Returns `null` while the proposal size is still unavailable.
 */
const Description = () => {
  const proposal = useProposal();
  const patterns = useSelectedPatterns();
  const isDesktopMissing = useIsDesktopMissing();

  if (!proposal?.usedSpace) return null;

  const size = xbytes(proposal.usedSpace * 1024, { iec: true });
  const hasDesktopContext = isDesktopMissing || patterns.some((p) => p.desktop);
  const additionalQty = patterns.filter((p) => !p.desktop).length;

  if (hasDesktopContext && additionalQty > 0) {
    return sprintf(
      // TRANSLATORS: software summary description combining the count of
      // non-desktop patterns selected on top of the desktop with the
      // required install size. %1$d is a number of additional patterns;
      // %2$s is a human-readable disk size (e.g. "5.95 GiB").
      n_(
        "Includes %1$d additional pattern. Requires %2$s",
        "Includes %1$d additional patterns. Requires %2$s",
        additionalQty,
      ),
      additionalQty,
      size,
    );
  }

  // TRANSLATORS: total installation size shown in the software summary.
  // %s is a human-readable disk size (e.g. "5.95 GiB").
  return sprintf(_("Requires %s"), size);
};

/**
 * A software installation summary.
 */
export default function SoftwareSummary() {
  const { loading } = useProgressTracking("software");
  const issues = useIssues("software");
  const hasIssues = !isEmpty(issues);

  return (
    <Summary
      hasIssues={hasIssues}
      icon="apps"
      title={
        <Link to={SOFTWARE.root} variant="link" isInline>
          {_("Software")}
        </Link>
      }
      value={hasIssues ? _("Invalid software selection") : <Value />}
      description={!hasIssues && <Description />}
      isLoading={loading}
    />
  );
}
