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

import React, { useEffect, useState } from "react";
import { Stack, StackItem } from "@patternfly/react-core";

import FirstUser from "./FirstUser";
import RootPassword from "./RootPassword";
import RootSSHKey from "./RootSSHKey";
import Category from "./Category";
import { useInstallerClient } from "./context/installer";

import {
  EOS_MANAGE_ACCOUNTS as UsersIcon,
} from "eos-icons-react";

export default function Users({ showErrors }) {
  const [errors, setErrors] = useState([]);
  const { users: usersClient } = useInstallerClient();

  useEffect(() => {
    usersClient.getValidationErrors().then(setErrors);
    return usersClient.onValidationChange(setErrors);
  }, [usersClient]);

  return (
    <>
      <Category key="users" title="Users" icon={UsersIcon} errors={showErrors ? errors : []}>
        <Stack className="overview-users">
          <StackItem>
            <RootPassword />
          </StackItem>
          <StackItem>
            <RootSSHKey />
          </StackItem>
          <StackItem>
            <FirstUser />
          </StackItem>
        </Stack>
      </Category>
    </>
  );
}
