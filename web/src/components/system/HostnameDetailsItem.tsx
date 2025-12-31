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
import { Flex } from "@patternfly/react-core";
import { isEmpty } from "radashi";
import Details from "~/components/core/Details";
import Link from "~/components/core/Link";
import { useProposal } from "~/hooks/model/proposal/hostname";
import { HOSTNAME } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Hostname settings summary
 *
 * If a transient hostname is in use, it shows a brief explanation to inform
 * users that the hostname may change after reboot or network changes.
 */
export default function HostnameDetailsItem() {
  const { hostname: transientHostname, static: staticHostname } = useProposal();

  return (
    <Details.Item label={_("Hostname")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        <Link to={HOSTNAME.root} variant="link" isInline>
          {staticHostname || transientHostname}
        </Link>
        {isEmpty(staticHostname) && (
          <small>
            {
              // TRANSLATORS: a note to briefly explain the possible side-effects
              // of using a transient hostname
              _("Temporary name that may change after reboot or network changes")
            }
          </small>
        )}
      </Flex>
    </Details.Item>
  );
}
