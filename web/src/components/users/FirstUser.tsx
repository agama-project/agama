/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import React, { useId } from "react";
import {
  Card,
  CardBody,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Stack,
} from "@patternfly/react-core";
import { Link, Page, SplitButton } from "~/components/core";
import PasswordCheck from "~/components/users/PasswordCheck";
import { useConfig } from "~/hooks/model/config";
import { useRemoveUser } from "~/hooks/model/config/user";
import { PATHS } from "~/routes/users";
import { isEmpty } from "radashi";
import { _ } from "~/i18n";

const UserActions = () => {
  const { user } = useConfig();
  const removeUser = useRemoveUser();

  if (isEmpty(user?.userName)) {
    return (
      <Link to={PATHS.firstUser.create} isPrimary>
        {_("Define a user now")}
      </Link>
    );
  }

  return (
    <SplitButton label={_("Edit")} href={PATHS.firstUser.edit} variant="secondary">
      <SplitButton.Item isDanger onClick={() => removeUser()}>
        {_("Discard")}
      </SplitButton.Item>
    </SplitButton>
  );
};

const UserData = () => {
  const { user } = useConfig();
  const fullnameTermId = useId();
  const usernameTermId = useId();

  if (isEmpty(user?.userName)) {
    return <Content isEditorial>{_("No user defined yet.")}</Content>;
  }

  return (
    <Card isCompact isPlain>
      <CardBody>
        <Stack hasGutter>
          <DescriptionList isHorizontal isFluid displaySize="lg" isCompact>
            <DescriptionListGroup>
              <DescriptionListTerm id={fullnameTermId}>{_("Full name")}</DescriptionListTerm>
              <DescriptionListDescription aria-labelledby={fullnameTermId}>
                {user.fullName}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm id={usernameTermId}>{_("Username")}</DescriptionListTerm>
              <DescriptionListDescription aria-labelledby={usernameTermId}>
                {user.userName}
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
          <PasswordCheck password={user.password} />
        </Stack>
      </CardBody>
    </Card>
  );
};

export default function FirstUser() {
  return (
    <Page.Section
      title={_("First user")}
      actions={<UserActions />}
      description={_("Define the first user with admin (sudo) privileges for system management.")}
    >
      <UserData />
    </Page.Section>
  );
}
