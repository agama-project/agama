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
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { useConfig } from "~/hooks/model/config";
import { useIssues } from "~/hooks/model/issue";
import { USER } from "~/routes/paths";
import { _ } from "~/i18n";
import Summary from "~/components/core/Summary";
import Link from "~/components/core/Link";

const rootConfigured = (config) => {
  if (!config.root) return false;

  const { password, sshPublicKey } = config.root;
  if (password && password !== "") return true;
  if (sshPublicKey && sshPublicKey !== "") return true;

  return false;
};

const userConfigured = (config) => {
  if (!config.user) return false;

  const { userName, fullName, password } = config.user;
  return userName !== "" && fullName !== "" && password !== "";
};

/**
 * Renders a summary text describing the authentication configuration.
 */
const Value = () => {
  const config = useConfig();
  const root = rootConfigured(config);
  const user = userConfigured(config);

  if (!root && !user) return _("Not configured yet");
  if (root && !user) return _("Configured for the root user");

  const userName = config.user.userName;
  // TRANSLATORS: %s is a username like 'jdoe'
  if (root) return sprintf(_("Configured for root and user '%s'"), userName);

  // TRANSLATORS: %s is a username like 'jdoe'
  return sprintf(_("Configured for user '%s'"), userName);
};

/**
 * Renders the estimated disk space required for the installation.
 */
const Description = () => {
  const config = useConfig();
  if (!rootConfigured(config)) return;

  const password = config.root.password || "";
  const sshKey = config.root.sshPublicKey || "";

  if (password !== "" && sshKey !== "") return _("Root login with password and SSH key");
  if (password !== "") return _("Root login with password");
  return _("Root login with SSH key");
};

/**
 * A software installation summary.
 */
export default function UsersSummary() {
  const { loading } = useProgressTracking("users");
  const hasIssues = !!useIssues("users").length;

  return (
    <Summary
      hasIssues={hasIssues}
      icon="manage_accounts"
      title={
        <Link to={USER.root} variant="link" isInline>
          {_("Authentication")}
        </Link>
      }
      value={<Value />}
      description={<Description />}
      isLoading={loading}
    />
  );
}
