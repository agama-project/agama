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
import { sprintf } from "sprintf-js";
import { isEmpty } from "radashi";
import Interpolate from "~/components/core/Interpolate";
import Link from "~/components/core/Link";
import Summary from "~/components/core/Summary";
import Text from "~/components/core/Text";
import { useConfig } from "~/hooks/model/config";
import { useProposal } from "~/hooks/model/proposal/hostname";
import { SYSTEM } from "~/routes/paths";
import { _, n_ } from "~/i18n";

/**
 * System settings summary
 *
 * Displays a summary of hostname and NTP server configuration.
 *
 * Title is a link that navigates to system configuration page.
 *
 * Value shows the hostname (in bold) and NTP server information: either the count
 * of custom servers or "Default NTP servers" when using product defaults.
 *
 * Description provides a brief explanation when using transient hostname mode.
 */
export default function SystemSummary() {
  const config = useConfig();
  const proposal = useProposal();
  const { hostname: transientHostname, static: staticHostname } = proposal || {};

  const hostname = staticHostname || transientHostname;
  const isTransient = isEmpty(staticHostname);

  const ntpSources = config?.ntp?.sources || [];
  const hasCustomNtpServers = ntpSources.length > 0;

  const ntpPart = hasCustomNtpServers
    ? sprintf(
        n_(
          // TRANSLATORS: NTP server count in system summary
          "%d NTP server",
          "%d NTP servers",
          ntpSources.length,
        ),
        ntpSources.length,
      )
    : // TRANSLATORS: default NTP servers indication in system summary
      _("Default NTP servers");

  const value = (
    <>
      <Interpolate
        sentence={
          // TRANSLATORS: system name in summary. %s will be replaced
          // with the name in bold.
          _("Name %s")
        }
      >
        {() => <Text isBold>{hostname}</Text>}
      </Interpolate>
      {" - "}
      {ntpPart}
    </>
  );

  const description = isTransient
    ? // TRANSLATORS: brief explanation for transient hostname mode
      _("Using transient name, which may change after reboot or network changes")
    : undefined;

  return (
    <Summary
      icon="fingerprint"
      title={
        <Link to={SYSTEM.root} variant="link" isInline>
          {_("System")}
        </Link>
      }
      value={value}
      description={description}
    />
  );
}
