/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { Stack } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { useNavigate } from "react-router-dom";
import { Link, Page, RowActions } from "~/components/core";
import { _ } from "~/i18n";
import { useFirstUser, useFirstUserChanges, useRemoveFirstUserMutation } from "~/queries/users";
import { PATHS } from "~/routes/users";

const DefineUserNow = () => (
  <Link to={PATHS.firstUser.create} isPrimary>
    {_("Define a user now")}
  </Link>
);

const UserNotDefined = () => (
  <Stack hasGutter>
    <div>{_("No user defined yet.")}</div>
    <div>
      <strong>
        {_(
          "Please, be aware that a user must be defined before installing the system to be able to log into it.",
        )}
      </strong>
    </div>
  </Stack>
);

const UserData = ({ user, actions }) => {
  return (
    <Table variant="compact">
      <Thead>
        <Tr>
          <Th width={25}>{_("Full name")}</Th>
          <Th>{_("Username")}</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Td dataLabel="Fullname">{user.fullName}</Td>
          <Td dataLabel="Username">{user.userName}</Td>
          <Td isActionCell>
            <RowActions actions={actions} id={`actions-for-${user.userName}`} />
          </Td>
        </Tr>
      </Tbody>
    </Table>
  );
};

export default function FirstUser() {
  const user = useFirstUser();
  const removeUser = useRemoveFirstUserMutation();
  const navigate = useNavigate();

  useFirstUserChanges();

  const isUserDefined = user?.userName && user?.userName !== "";
  const actions = [
    {
      title: _("Edit"),
      onClick: () => navigate(PATHS.firstUser.edit),
    },
    {
      title: _("Discard"),
      onClick: () => removeUser.mutate(),
      isDanger: true,
    },
  ];

  return (
    <Page.Section title={_("First user")} actions={!isUserDefined && <DefineUserNow />}>
      {isUserDefined ? <UserData user={user} actions={actions} /> : <UserNotDefined />}
    </Page.Section>
  );
}
