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

const userConfigured = (config) => {
  if (!config.user) return false;
  const { userName, fullName, password } = config.user;
  return !isEmpty(userName) && !isEmpty(fullName) && !isEmpty(password);
};

const userHasSsh = (config) =>
  !isEmpty(config.user?.sshPublicKey) || !isEmpty(config.user?.sshPublicKeys);

const Value = () => {
  const config = useConfig();
  const rootAuthType = getRootAuthType(config);
  const hasRoot = rootAuthType !== "none";
  const hasUser = userConfigured(config);

  if (!hasRoot && !hasUser) return _("Not configured yet");
  if (hasRoot && !hasUser) return _("Using root account");

  const userName = config.user.userName;

  if (!hasRoot) {
    // TRANSLATORS: %s is a username like 'jdoe'
    const [textStart, textEnd] = _("Using %s account").split("%s");
    return (
      <>
        {textStart}
        <Text isBold>{userName}</Text>
        {textEnd}
      </>
    );
  }

  // TRANSLATORS: %s is a username like 'jdoe'
  const [textStart, textEnd] = _("Using %s and root account").split("%s");

  return (
    <>
      {textStart}
      <Text isBold>{userName}</Text>
      {textEnd}
    </>
  );
};

const Description = () => {
  const config = useConfig();
  const rootAuthType = getRootAuthType(config);
  const hasRoot = rootAuthType !== "none";
  const hasUser = userConfigured(config);
  const hasSsh = userHasSsh(config);

  // Root only
  if (hasRoot && !hasUser) {
    if (rootAuthType === "password") return _("Password only");
    if (rootAuthType === "ssh") return _("Allowing SSH access via public key");
    if (rootAuthType === "both") return _("Password and allowing SSH access");
  }

  // User only
  if (!hasRoot && hasUser) {
    if (hasSsh) return _("Allowing SSH access via public key");
    return _("Password only");
  }

  // Both root and user
  if (hasRoot && hasUser) {
    if (rootAuthType === "password" && !hasSsh) return _("Root with password only");
    if (rootAuthType === "password" && hasSsh)
      return _("Root with password only, user allowing SSH access");
    if (rootAuthType === "ssh" && !hasSsh) return _("Root allowing SSH access via public key");
    if (rootAuthType === "ssh" && hasSsh) return _("Both allowing SSH access via public key");
    if (rootAuthType === "both" && !hasSsh) return _("Root with password and allowing SSH access");
    if (rootAuthType === "both" && hasSsh) return _("Both with password and allowing SSH access");
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
          {_("Authentication")}
        </Link>
      }
      value={<Value />}
      description={<Description />}
      isLoading={loading}
    />
  );
}
