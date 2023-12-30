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

import React, { useReducer, useEffect } from "react";
import { If, Em, Section, SectionSkeleton } from "~/components/core";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";

const initialState = {
  busy: true,
  errors: [],
  user: undefined,
  rootSSHKey: undefined,
  rootPasswordSet: false,
};

const reducer = (state, action) => {
  const { type: actionType, payload } = action;

  switch (actionType) {
    case "UPDATE_STATUS": {
      return { ...initialState, ...payload };
    }

    default: {
      return state;
    }
  }
};

export default function UsersSection({ showErrors }) {
  const { users: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user, rootPasswordSet, rootSSHKey } = state;

  const updateStatus = ({ ...payload }) => {
    dispatch({ type: "UPDATE_STATUS", payload });
  };

  useEffect(() => {
    const loadData = async () => {
      const user = await cancellablePromise(client.getUser());
      const rootPasswordSet = await cancellablePromise(client.isRootPasswordSet());
      const rootSSHKey = await cancellablePromise(client.getRootSSHKey());
      const errors = await cancellablePromise(client.getValidationErrors());

      updateStatus({ user, rootPasswordSet, rootSSHKey, errors, busy: false });
    };

    loadData();

    return client.onValidationChange(
      (errors) => updateStatus({ errors })
    );
  }, [client, cancellablePromise]);

  const errors = showErrors ? state.errors : [];

  // TRANSLATORS: %s will be replaced by the user name
  const [msg1, msg2] = _("User %s will be created").split("%s");
  const UserSummary = () => {
    return (
      <div>
        <If
          condition={user?.userName !== ""}
          then={<>{msg1}<Em>{state.user.userName}</Em>{msg2}</>}
          else={<>{_("No user defined yet")}</>}
        />
      </div>
    );
  };

  const RootAuthSummary = () => {
    const both = rootPasswordSet && rootSSHKey !== "";
    const none = !rootPasswordSet && rootSSHKey === "";
    const onlyPassword = rootPasswordSet && rootSSHKey === "";
    const onlySSHKey = !rootPasswordSet && rootSSHKey !== "";

    return (
      <div>
        <If condition={both} then={<>{_("Root authentication set for using both, password and public SSH Key")}</>} />
        <If condition={none} then={<>{_("No root authentication method defined")}</>} />
        <If condition={onlyPassword} then={<>{_("Root authentication set for using password")}</>} />
        <If condition={onlySSHKey} then={<>{_("Root authentication set for using public SSH Key")}</>} />
      </div>
    );
  };

  const Summary = () => (
    <>
      <UserSummary />
      <RootAuthSummary />
    </>
  );

  return (
    <Section
      key="users-section"
      // TRANSLATORS: page section title
      title={_("Users")}
      icon="manage_accounts"
      loading={state.busy}
      errors={errors}
      path="/users"
      sectionId="users"
    >
      { state.busy ? <SectionSkeleton /> : <Summary /> }
    </Section>
  );
}
