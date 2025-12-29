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
import Details from "~/components/core/Details";
import Link from "~/components/core/Link";
import { useProposal } from "~/hooks/model/proposal/hostname";
import { HOSTNAME } from "~/routes/paths";
import { _ } from "~/i18n";

const Static = ({ hostname }) => {
  return (
    <Link to={HOSTNAME.root} variant="link" isInline>
      {hostname}
    </Link>
  );
};

const Transient = ({ hostname }) => {
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      <Link to={HOSTNAME.root} variant="link" isInline>
        {hostname}
      </Link>
      <small>{_("Automatically assigned, may change after reboot or network updates")}</small>
    </Flex>
  );
};

export default function HostnameDetailsItem() {
  const { hostname: transient, static: staticHostname } = useProposal();

  return (
    <Details.Item label={_("Hostname")}>
      {staticHostname ? <Static hostname={staticHostname} /> : <Transient hostname={transient} />}
    </Details.Item>
  );
}
