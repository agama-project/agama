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
import { isEmpty } from "radashi";
import Text from "~/components/core/Text";
import Interpolate from "~/components/core/Interpolate";
import { _ } from "~/i18n";

import type { Config } from "~/model/config";

type Account = { sshPublicKey?: string | string[]; sshPublicKeys?: string | string[] };

/** Whether the account has any SSH public key to log in with. */
const hasSshKey = (account?: Account) =>
  !isEmpty(account?.sshPublicKey) || !isEmpty(account?.sshPublicKeys);

/**
 * Determines the root authentication method type.
 * @returns {"none"|"password"|"ssh"|"both"}
 */
export const getRootAuthType = (config: Config) => {
  if (!config.root) return "none";

  const hasPassword = !isEmpty(config.root.password);
  const hasKey = hasSshKey(config.root);

  if (hasPassword && hasKey) return "both";
  if (hasPassword) return "password";
  if (hasKey) return "ssh";
  return "none";
};

export const isUserDefined = (config: Config) => {
  if (!config.user) return false;
  const { userName, fullName, password } = config.user;
  return !isEmpty(userName) && !isEmpty(fullName) && !isEmpty(password);
};

/** Whether the config sets any account to log in with. */
export const hasAccounts = (config: Config) =>
  getRootAuthType(config) !== "none" || isUserDefined(config);

/** Which of the accounts set have an SSH public key to log in with. */
export const accountsWithSshKeys = (config: Config) => ({
  root: hasSshKey(config.root),
  user: isUserDefined(config) && hasSshKey(config.user),
});

/** Whether any account set has an SSH public key to log in with. */
export const hasSshKeys = (config: Config) => {
  const withKeys = accountsWithSshKeys(config);
  return withKeys.root || withKeys.user;
};

/**
 * Renders "Using %s account" with the account name in bold.
 */
const Account = ({ name }: { name: string }) => (
  // TRANSLATORS: %s is either "root" or a username like 'jdoe'
  <Interpolate sentence={_("Using %s account")}>{() => <Text isBold>{name}</Text>}</Interpolate>
);

/**
 * Tells which accounts, if any, the config sets to log in with: "Using jdoe
 * and root accounts", "Using root account"...
 */
export default function ConfiguredAccounts({ config }: { config: Config }) {
  const hasRoot = getRootAuthType(config) !== "none";
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
}

/**
 * Renders "Public key provided for %s" with the account name in bold.
 */
const PublicKeyProvided = ({ name }: { name: string }) => (
  // TRANSLATORS: %s is either "root" or a username like 'jdoe'
  <Interpolate sentence={_("Public key provided for %s")}>
    {() => <Text isBold>{name}</Text>}
  </Interpolate>
);

/**
 * Tells which accounts the config gives an SSH public key to log in with, if
 * any: "Public key provided for both", "Public key provided for root"... The
 * account is named only when there is another one without a key.
 */
export function ConfiguredSshKeys({ config }: { config: Config }) {
  const withKeys = accountsWithSshKeys(config);
  const hasRoot = getRootAuthType(config) !== "none";
  const hasUser = isUserDefined(config);

  // TRANSLATORS: both user accounts have SSH public keys configured
  if (withKeys.root && withKeys.user) return _("Public key provided for both");
  if (!withKeys.root && !withKeys.user) return null;

  if (withKeys.root && hasUser) return <PublicKeyProvided name="root" />;
  if (withKeys.user && hasRoot) return <PublicKeyProvided name={config.user.userName} />;

  // TRANSLATORS: SSH public key is configured for a single account
  return _("Public key provided");
}
