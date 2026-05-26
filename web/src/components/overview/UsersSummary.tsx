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
import { isEmpty } from "radashi";
import { useProgressTracking } from "~/hooks/use-progress-tracking";
import { useConfig } from "~/hooks/model/config";
import { useIssues } from "~/hooks/model/issue";
import Summary from "~/components/core/Summary";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import Interpolate from "~/components/core/Interpolate";
import { USER } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Determines the root authentication method type.
 * @returns {"none"|"password"|"ssh"|"both"}
 */
const getRootAuthType = (config) => {
  if (!config.root) return "none";

  const hasPassword = !isEmpty(config.root.password);
  const hasSshKey = !isEmpty(config.root.sshPublicKey) || !isEmpty(config.root.sshPublicKeys);

  if (hasPassword && hasSshKey) return "both";
  if (hasPassword) return "password";
  if (hasSshKey) return "ssh";
  return "none";
};

const isUserDefined = (config) => {
  if (!config.user) return false;
  const { userName, fullName, password } = config.user;
  return !isEmpty(userName) && !isEmpty(fullName) && !isEmpty(password);
};

/**
 * Renders "Public key provided for %s" with the account name in bold.
 * Used when only one of the two accounts has a public key configured.
 */
const PublicKeyProvided = ({ user }) => (
  // TRANSLATORS: %s is either "root" or a username like 'jdoe'
  <Interpolate sentence={_("Public key provided for %s")}>
    {() => <Text isBold>{user}</Text>}
  </Interpolate>
);

/**
 * Renders "Using %s account" with the account name in bold.
 * Used in the summary value to show which accounts are configured.
 */
const Account = ({ name }) => (
  // TRANSLATORS: %s is either "root" or a username like 'jdoe'
  <Interpolate sentence={_("Using %s account")}>{() => <Text isBold>{name}</Text>}</Interpolate>
);

/**
 * Renders which accounts, if any, are configured for login.
 */
const Value = () => {
  const config = useConfig();
  const rootAuthType = getRootAuthType(config);
  const hasRoot = rootAuthType !== "none";
  const hasUser = isUserDefined(config);

  // TRANSLATORS: shown when no user accounts are configured yet
  if (!hasRoot && !hasUser) return _("Not configured yet");
  if (hasRoot && !hasUser) return <Account name="root" />;

  const userName = config.user.userName;

  if (!hasRoot) return <Account name={userName} />;

  // TRANSLATORS: first %s is a username like 'jdoe', second is "root"
  return (
    <Interpolate sentence={_("Using %s and %s accounts")}>
      {[
        () => <Text isBold>{userName}</Text>,
        // eslint-disable-next-line i18next/no-literal-string
        () => <Text isBold>root</Text>,
      ]}
    </Interpolate>
  );
};

/**
 * Renders a description highlighting public key configuration status.
 *
 * Only shown when worth highlighting: public keys provided, or the important
 * case where root has no public key (SSH login might be restricted on most systems).
 * Password-only user accounts are not mentioned since password login is always available.
 */
const Description = () => {
  const config = useConfig();
  const rootAuthType = getRootAuthType(config);
  const hasRoot = rootAuthType !== "none";
  const hasUser = isUserDefined(config);
  const userHasSsh = !isEmpty(config.user?.sshPublicKey) || !isEmpty(config.user?.sshPublicKeys);

  if (!hasRoot && !hasUser) return null;

  const rootHasSshKey = rootAuthType === "ssh" || rootAuthType === "both";
  const userHasSshKey = hasUser && userHasSsh;

  // TRANSLATORS: both user accounts have SSH public keys configured
  if (rootHasSshKey && userHasSshKey) return _("Public key provided for both");

  // TRANSLATORS: SSH public key is configured for a single account
  const publicKeyProvided = _("Public key provided");

  if (userHasSshKey && !hasRoot) return publicKeyProvided;
  if (userHasSshKey && !rootHasSshKey) return <PublicKeyProvided user={config.user.userName} />;

  if (rootHasSshKey && !hasUser) return publicKeyProvided;
  if (rootHasSshKey && hasUser && !userHasSshKey) return <PublicKeyProvided user="root" />;

  if (!hasUser && hasRoot && !rootHasSshKey) {
    // TRANSLATORS: warning when root account has no SSH public key configured
    return _("No public key provided, SSH login might be restricted");
  }

  return null;
};

export default function UsersSummary() {
  const { loading } = useProgressTracking("users");
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
