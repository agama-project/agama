/*
 * Copyright (c) [2025] SUSE LLC
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
import xbytes from "xbytes";
import { sprintf } from "sprintf-js";

import { useProposal } from "~/hooks/model/proposal/software";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { useSelectedPatterns } from "~/hooks/model/system/software";
import { SOFTWARE } from "~/routes/paths";
import { _, n_ } from "~/i18n";
import Summary from "~/components/core/Summary";
import Link from "~/components/core/Link";

/**
 * Renders a summary text describing the software selection.
 */
const Value = () => {
  const patterns = useSelectedPatterns();
  const patternsQty = patterns.length;

  if (patternsQty === 0) {
    return _("Required packages");
  }

  return sprintf(
    // TRANSLATORS: %s will be replaced with amount of selected patterns.
    n_("Required packages and %s pattern", "Required packages and %s patterns", patternsQty),
    patternsQty,
  );
};

/**
 * Renders the estimated disk space required for the installation.
 */
const Description = () => {
  const proposal = useProposal();

  if (!proposal.usedSpace) return;

  return sprintf(
    // TRANSLATORS: %s will be replaced with a human-readable installation size
    // (e.g. 5.95 GiB).
    _("Needs about %s"),
    xbytes(proposal.usedSpace * 1024, { iec: true }),
  );
};

/**
 * A software installation summary.
 */
export default function SoftwareSummary() {
  const { loading } = useProgressTracking("software");
  return (
    <Summary
      icon="apps"
      title={
        <Link to={SOFTWARE.root} variant="link" isInline>
          {_("Software")}
        </Link>
      }
      value={<Value />}
      description={<Description />}
      isLoading={loading}
    />
  );
}
