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
 * Renders "SSH login enabled for %s" with the account name in bold.
 * Used when only one of the two accounts has SSH login enabled.
 */
const SshEnabledFor = ({ name }) => (
  // TRANSLATORS: %s is either "root" or a username like 'jdoe'
  <Interpolate sentence={_("SSH login enabled for %s")}>
    {() => <Text isBold>{name}</Text>}
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
 * Displays which accounts, if any, are configured for login.
 */
const Value = () => {
  const config = useConfig();
  const rootAuthType = getRootAuthType(config);
  const hasRoot = rootAuthType !== "none";
  const hasUser = isUserDefined(config);

  if (!hasRoot && !hasUser) return _("Not configured yet");
  if (hasRoot && !hasUser) return <Account name="root" />;

  const userName = config.user.userName;

  if (!hasRoot) return <Account name={userName} />;

  // TRANSLATORS: first %s is a username like 'jdoe', second is the literal word "root" which must not be translated
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
 * Displays a summary of the SSH login configuration.
 *
 * Only shown when SSH login is enabled for at least one account,
 * since password login is always set for the user and not worth highlighting.
 * For root, SSH-only login (no password) is explicitly surfaced since it is
 * not mandatory; if root has no SSH, it implies password login.
 */
const Description = () => {
  const config = useConfig();
  const rootAuthType = getRootAuthType(config);
  const hasRoot = rootAuthType !== "none";
  const hasUser = isUserDefined(config);
  const userHasSsh = !isEmpty(config.user?.sshPublicKey) || !isEmpty(config.user?.sshPublicKeys);

  if (!hasRoot && !hasUser) return null;

  const sshForRoot = rootAuthType === "ssh" || rootAuthType === "both";
  const sshForUser = hasUser && userHasSsh;

  if (sshForRoot && sshForUser) return _("SSH login enabled for both accounts");

  if (rootAuthType === "ssh" && hasUser) {
    // TRANSLATORS: "root" refers to the root user account, must not be translated
    return (
      <Interpolate sentence={_("%s login enabled only with SSH key")}>
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {() => <Text isBold>root</Text>}
      </Interpolate>
    );
  }

  if (rootAuthType === "ssh") return _("Login enabled only with SSH key");

  if (sshForRoot && hasUser) return <SshEnabledFor name="root" />;

  if (sshForRoot) return _("SSH login enabled");

  if (sshForUser && hasRoot) return <SshEnabledFor name={config.user.userName} />;

  if (sshForUser) return _("SSH login enabled");

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
          {_("Authentication")}
        </Link>
      }
      value={<Value />}
      description={<Description />}
      isLoading={loading}
    />
  );
}
