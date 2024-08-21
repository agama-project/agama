/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useState, useEffect } from "react";
import { Button, Skeleton, Split, Stack, Truncate } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { Em, RowActions } from "~/components/core";
import { RootPasswordPopup, RootSSHKeyPopup } from "~/components/users";

import { _ } from "~/i18n";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { useRootUser, useRootUserChanges, useRootUserMutation } from "~/queries/users";

const MethodsNotDefined = ({ setPassword, setSSHKey }) => {
  return (
    <Stack hasGutter>
      <div>{_("No root authentication method defined yet.")}</div>
      <div>
        <strong>
          {_(
            "Please, define at least one authentication method for logging into the system as root.",
          )}
        </strong>
      </div>
      <Split hasGutter>
        {/* TRANSLATORS: push button label */}
        <Button variant="primary" onClick={setPassword}>
          {_("Set a password")}
        </Button>
        {/* TRANSLATORS: push button label */}
        <Button variant="secondary" onClick={setSSHKey}>
          {_("Upload a SSH Public Key")}
        </Button>
      </Split>
    </Stack>
  );
};
export default function RootAuthMethods() {
  const setRootUser = useRootUserMutation();
  const [isSSHKeyFormOpen, setIsSSHKeyFormOpen] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);

  const { password: isPasswordDefined, sshkey: sshKey } = useRootUser();

  useRootUserChanges();

  const isSSHKeyDefined = sshKey !== "";
  const openPasswordForm = () => setIsPasswordFormOpen(true);
  const openSSHKeyForm = () => setIsSSHKeyFormOpen(true);
  const closePasswordForm = () => setIsPasswordFormOpen(false);
  const closeSSHKeyForm = () => setIsSSHKeyFormOpen(false);

  const passwordActions = [
    {
      title: isPasswordDefined ? _("Change") : _("Set"),
      onClick: openPasswordForm,
    },
    isPasswordDefined && {
      title: _("Discard"),
      onClick: () => setRootUser.mutate({ password: "" }),
      isDanger: true,
    },
  ].filter(Boolean);

  const sshKeyActions = [
    {
      title: isSSHKeyDefined ? _("Change") : _("Set"),
      onClick: openSSHKeyForm,
    },
    sshKey && {
      title: _("Discard"),
      onClick: () => setRootUser.mutate({ sshkey: "" }),
      isDanger: true,
    },
  ].filter(Boolean);

  const PasswordLabel = () => {
    return isPasswordDefined ? _("Already set") : _("Not set");
  };

  const SSHKeyLabel = () => {
    if (!isSSHKeyDefined) return _("Not set");

    const trailingChars = Math.min(sshKey.length - sshKey.lastIndexOf(" "), 30);

    return (
      <Em>
        <Truncate content={sshKey} trailingNumChars={trailingChars} position="middle" />
      </Em>
    );
  };

  const Content = () => {
    if (!isPasswordDefined && !isSSHKeyDefined) {
      return <MethodsNotDefined setPassword={openPasswordForm} setSSHKey={openSSHKeyForm} />;
    }

    return (
      <Table variant="compact" gridBreakPoint="grid-md">
        <Thead>
          <Tr>
            {/* TRANSLATORS: table header, user authentication method */}
            <Th width={25}>{_("Method")}</Th>
            {/* TRANSLATORS: table header */}
            <Th>{_("Status")}</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td dataLabel="Method">{_("Password")}</Td>
            <Td dataLabel="Status">
              <PasswordLabel />
            </Td>
            <Td isActionCell>
              <RowActions actions={passwordActions} id="actions-for-root-password" />
            </Td>
          </Tr>
          <Tr>
            <Td dataLabel="Method">{_("SSH Key")}</Td>
            <Td dataLabel="Status">
              <SSHKeyLabel />
            </Td>
            <Td isActionCell>
              <RowActions actions={sshKeyActions} id="actions-for-root-sshKey" />
            </Td>
          </Tr>
        </Tbody>
      </Table>
    );
  };

  return (
    <>
      <Content />
      {isPasswordFormOpen && (
        <RootPasswordPopup
          isOpen
          title={isPasswordDefined ? _("Change the root password") : _("Set a root password")}
          onClose={closePasswordForm}
        />
      )}

      {isSSHKeyFormOpen && (
        <RootSSHKeyPopup
          isOpen
          title={
            isSSHKeyDefined
              ? _("Edit the SSH Public Key for root")
              : _("Add a SSH Public Key for root")
          }
          currentKey={sshKey}
          onClose={closeSSHKeyForm}
        />
      )}
    </>
  );
}
