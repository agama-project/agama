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

import React from "react";
import { sprintf } from "sprintf-js";
import { isEmpty, isNullish } from "radashi";
import Interpolate from "~/components/core/Interpolate";
import Link from "~/components/core/Link";
import Summary from "~/components/core/Summary";
import Text from "~/components/core/Text";
import { useConfig } from "~/hooks/model/config";
import { useProposal } from "~/hooks/model/proposal/hostname";
import { SYSTEM } from "~/routes/paths";
import { _, n_ } from "~/i18n";

/**
 * Renders the hostname with bold formatting
 */
function HostnameTitleInfo({ hostname }: { hostname: string }) {
  return (
    <Interpolate
      sentence={
        // TRANSLATORS: system hostname in summary. %s is the hostname.
        _("Name %s")
      }
    >
      {() => <Text isBold>{hostname}</Text>}
    </Interpolate>
  );
}

/**
 * Renders explanation text for transient hostname mode
 */
function HostnameTransientDescription() {
  return (
    // TRANSLATORS: explanation shown when hostname is transient (not static)
    _("Using transient name, which may change after reboot or network changes")
  );
}

/**
 * Renders short NTP information for inline display (transient hostname mode)
 */
function NtpTitleInfo({ servers }: { servers: string[] }) {
  return servers.length > 0
    ? sprintf(
        n_(
          // TRANSLATORS: NTP server count shown inline (transient mode). %d is the count.
          "%d NTP server",
          "%d NTP servers",
          servers.length,
        ),
        servers.length,
      )
    : // TRANSLATORS: shown when using product default NTP servers (transient mode)
      _("Default NTP");
}

/**
 * Renders full NTP information sentence
 */
function NtpDescriptionInfo({ servers }: { servers: string[] }) {
  if (servers.length === 0) {
    return (
      // TRANSLATORS: shown when using product default NTP servers (static mode)
      _("Default NTP")
    );
  }

  if (servers.length === 1) {
    return (
      <Interpolate
        sentence={
          // TRANSLATORS: shown when using a single custom NTP server (static mode). %s is the server address (shown in bold).
          _("Using %s as NTP server")
        }
      >
        {() => <Text isBold>{servers[0]}</Text>}
      </Interpolate>
    );
  }

  return (
    <Interpolate
      sentence={sprintf(
        // TRANSLATORS: shown when using multiple custom NTP servers (static mode). First %s is the count, second %s is the first server address. Keep the brackets [] around the second %s - they mark bold text.
        _("Using %s NTP servers, including [%s]"),
        servers.length.toString(),
        servers[0],
      )}
    >
      {(ntpServer) => <Text isBold>{ntpServer}</Text>}
    </Interpolate>
  );
}

/**
 * System settings summary
 *
 * Displays a summary of hostname and NTP server configuration.
 *
 * Title is a link that navigates to system configuration page.
 *
 * For transient hostnames: shows name and NTP info on one line with a dash separator,
 * with an explanation description below.
 *
 * For static hostnames: shows only the name in value, with NTP info in description.
 */
export default function SystemSummary() {
  const config = useConfig();
  const proposal = useProposal();
  const { hostname: transientHostname, static: staticHostname } = proposal || {};

  const isTransient = isEmpty(staticHostname) || isNullish(staticHostname);
  const hostname = isTransient ? transientHostname : staticHostname;
  const ntpServers = (config?.ntp?.sources || []).map((s) => s.address);

  return (
    <Summary
      icon="fingerprint"
      title={
        <Link to={SYSTEM.root} variant="link" isInline>
          {_("System")}
        </Link>
      }
      value={
        isTransient ? (
          <>
            <HostnameTitleInfo hostname={hostname} />
            {" - "}
            <NtpTitleInfo servers={ntpServers} />
          </>
        ) : (
          <HostnameTitleInfo hostname={hostname} />
        )
      }
      description={
        isTransient ? <HostnameTransientDescription /> : <NtpDescriptionInfo servers={ntpServers} />
      }
    />
  );
}
