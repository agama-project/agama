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
import { shake } from "radashi";
import { Flex, Skeleton } from "@patternfly/react-core";
import Details from "~/components/core/Details";
import Link from "~/components/core/Link";
import { useSystem } from "~/hooks/model/system/software";
import { useProposal } from "~/hooks/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";
import { SOFTWARE } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import { useProgressTracking } from "~/hooks/use-progress-tracking";

// TODO: put in a more generic, reusable place
const useSelectedPatterns = () => {
  const proposal = useProposal();
  const { patterns } = useSystem();

  const selectedPatternsKeys = Object.keys(
    shake(proposal.patterns, (value) => value === SelectedBy.NONE),
  );

  return patterns.filter((p) => selectedPatternsKeys.includes(p.name));
};

const Summary = () => {
  const patterns = useSelectedPatterns();
  const patternsQty = patterns.length;

  if (patternsQty === 0) {
    return _("Base system");
  }

  return sprintf(
    // TRANSLATORS: %s will be replaced with amount of selected patterns.
    n_("Base system and %s pattern", "Base system and %s patterns", patternsQty),
    patternsQty,
  );
};

const Description = () => {
  const proposal = useProposal();

  if (!proposal.usedSpace) return;

  return sprintf(
    // TRANSLATORS: %s will be replaced with a human-readable installation size
    // (e.g. 5.95 GiB).
    _("Estimated installation size: %s"),
    xbytes(proposal.usedSpace * 1024, { iec: true }),
  );
};

export default function SoftwareDetailsItem() {
  const { loading } = useProgressTracking("software");

  return (
    <Details.Item label={_("Software")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        {loading ? (
          <Skeleton width="50%" />
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
