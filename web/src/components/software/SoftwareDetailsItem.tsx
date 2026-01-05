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
import { Flex, Skeleton } from "@patternfly/react-core";

import { useProposal } from "~/hooks/model/proposal/software";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { useSelectedPatterns } from "~/hooks/model/system/software";
import { SOFTWARE } from "~/routes/paths";
import { _, n_ } from "~/i18n";
import Details from "~/components/core/Details";
import Link from "~/components/core/Link";

/**
 * Renders a summary text describing the software selection.
 */
const Summary = () => {
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
export default function SoftwareDetailsItem() {
  const { loading } = useProgressTracking("software");
  return (
    <Details.Item label={_("Software")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        {loading ? (
          <Skeleton aria-label={_("Waiting for proposal")} width="50%" />
        ) : (
          <Link to={SOFTWARE.root} variant="link" isInline>
            <Summary />
          </Link>
        )}
        <small>{loading ? <Skeleton /> : <Description />}</small>
      </Flex>
    </Details.Item>
  );
}
