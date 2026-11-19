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
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { CONFIG_QUERY_KEY } from "~/hooks/model/config";
import { useConfig } from "~/hooks/model/config";
import { useIssues } from "~/hooks/model/issue";
import Summary from "~/components/core/Summary";
import Link from "~/components/core/Link";
import ConfiguredAccounts, {
  ConfiguredSshKeys,
  getRootAuthType,
  hasSshKeys,
  isUserDefined,
} from "~/components/users/ConfiguredAccounts";
import { USER } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Renders which accounts, if any, are configured for login.
 */
const Value = () => <ConfiguredAccounts config={useConfig()} />;

/**
 * Renders a description highlighting public key configuration status.
 *
 * Only shown when worth highlighting: public keys provided, or the important
 * case where root has no public key (SSH login might be restricted on most systems).
 * Password-only user accounts are not mentioned since password login is always available.
 */
const Description = () => {
  const config = useConfig();

  if (hasSshKeys(config)) return <ConfiguredSshKeys config={config} />;

  if (getRootAuthType(config) === "password" && !isUserDefined(config)) {
    // TRANSLATORS: warning when root account has no SSH public key configured
    return _("No public key provided, SSH login might be restricted");
  }

  return null;
};

export default function UsersSummary() {
  const { loading } = useProgressTracking("users", [CONFIG_QUERY_KEY]);
  const hasIssues = !!useIssues("users").length;

  return (
    <Summary
      hasIssues={hasIssues}
      icon="manage_accounts"
      title={
        <Link to={USER.root} variant="link" isInline>
          {/* TRANSLATORS: section title for user authentication configuration */}
          {_("Authentication")}
        </Link>
      }
      value={<Value />}
      description={<Description />}
      isLoading={loading}
    />
  );
}
