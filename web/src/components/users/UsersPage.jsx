/*
 * Copyright (c) [2022] SUSE LLC
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

import React from "react";
// import React, { useEffect, useState } from "react";
// import { useInstallerClient } from "~/context/installer";
import { Button } from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { Section } from "~/components/core";
import { FirstUser, RootPassword, RootSSHKey } from "~/components/users";
import { Icon, Title, PageIcon, MainActions } from "~/components/layout";

export default function UsersPage() {
  const navigate = useNavigate();
  // const [errors, setErrors] = useState([]);
  // const { users: usersClient } = useInstallerClient();
  //
  // useEffect(() => {
  //   usersClient.getValidationErrors().then(setErrors);
  //   return usersClient.onValidationChange(setErrors);
  // }, [usersClient]);

  return (
    <>
      <Title>Users settings</Title>
      <PageIcon><Icon name="manage_accounts" /></PageIcon>
      <MainActions>
        <Button isLarge variant="primary" onClick={() => navigate("/")}>
          Accept
        </Button>
      </MainActions>

      <Section key="first-user" title="User" iconName="person">
        <FirstUser />
      </Section>
      <Section key="root-settings" title="Root settings" iconName="badge">
        <RootPassword />
        <RootSSHKey />
      </Section>
    </>
  );
}
