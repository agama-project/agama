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
import { Skeleton, Truncate } from "@patternfly/react-core";
import { TableComposable, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { Em, RowActions } from '~/components/core';
import { RootPasswordPopup, RootSSHKeyPopup } from '~/components/users';

import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";

const RootPasswordRow = ({ isPasswordDefined }) => {
  const { users: client } = useInstallerClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const openForm = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);

  const passwordActions = [
    {
      title: isPasswordDefined ? "Change" : "Set",
      onClick: openForm,

    },
    isPasswordDefined && {
      title: "Discard",
      onClick: () => client.removeRootPassword(),
      className: "danger-action"
    }
  ].filter(Boolean);

  const PasswordLabel = () => isPasswordDefined ? "Already set" : "Not set";

  return (
    <Tr>
      <Td dataLabel="Method">Password</Td>
      <Td dataLabel="Status"><PasswordLabel /></Td>
      <Td isActionCell>
        <RowActions actions={passwordActions} id="actions-for-root-password" />
        <RootPasswordPopup
          isOpen={isFormOpen}
          title={isPasswordDefined ? "Change the root password" : "Set a root password"}
          onClose={closeForm}
        />
      </Td>
    </Tr>
  );
};

const RootSSHKeyRow = ({ sshKey }) => {
  const { users: client } = useInstallerClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const openForm = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);

  const isSSHKeyDefined = sshKey !== "";

  const sshKeyActions = [
    {
      title: isSSHKeyDefined ? "Change" : "Set",
      onClick: openForm
    },
    sshKey && {
      title: "Discard",
      onClick: () => client.setRootSSHKey(""),
      className: "danger-action"
    }

  ].filter(Boolean);

  const SSHKeyLabel = () => {
    if (!isSSHKeyDefined) return "Not set";

    const trailingChars = Math.min(sshKey.length - sshKey.lastIndexOf(" "), 30);

    return (
      <Em>
        <Truncate content={sshKey} trailingNumChars={trailingChars} position="middle" />
      </Em>
    );
  };

  return (
    <Tr>
      <Td dataLabel="Method">SSH Key</Td>
      <Td dataLabel="Status"><SSHKeyLabel /></Td>
      <Td isActionCell>
        <RowActions actions={sshKeyActions} id="actions-for-root-sshKey" />
        <RootSSHKeyPopup
          isOpen={isFormOpen}
          title={isSSHKeyDefined ? "Edit the SSH Public Key for root" : "Add a SSH Public Key for root" }
          currentKey={sshKey}
          onClose={closeForm}
        />
      </Td>
    </Tr>

  );
};

export default function RootAuthMethods() {
  const { users: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [isPasswordDefined, setIsPasswordDefined] = useState(false);
  const [sshKey, setSSHKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const isPasswordSet = await cancellablePromise(client.isRootPasswordSet());
        const sshKey = await cancellablePromise(client.getRootSSHKey());

        setIsPasswordDefined(isPasswordSet);
        setSSHKey(sshKey);
      } catch (error) {
        // TODO: handle/display errors
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [client, cancellablePromise]);

  useEffect(() => {
    return client.onUsersChange(changes => {
      if (changes.rootPasswordSet !== undefined) setIsPasswordDefined(changes.rootPasswordSet);
      if (changes.rootSSHKey !== undefined) setSSHKey(changes.rootSSHKey);
    });
  }, [client]);

  if (isLoading) {
    return (
      <>
        <Skeleton />
        <Skeleton />
      </>
    );
  }

  return (
    <TableComposable variant="compact" gridBreakPoint="grid-md">
      <Thead>
        <Tr>
          <Th width={25}>Method</Th>
          <Th>Status</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        <RootPasswordRow isPasswordDefined={isPasswordDefined} />
        <RootSSHKeyRow sshKey={sshKey} />
      </Tbody>
    </TableComposable>
  );
}
