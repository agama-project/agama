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

import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { Section } from "~/components/core";
import { Text } from "@patternfly/react-core";

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
  const { users: usersClient } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  const updateStatus = ({ ...payload }) => {
    dispatch({ type: "UPDATE_STATUS", payload });
  };

  useEffect(() => {
    const loadData = async () => {
      const user = await cancellablePromise(usersClient.getUser());
      const rootPasswordSet = await cancellablePromise(usersClient.isRootPasswordSet());
      const rootSSHKey = await cancellablePromise(usersClient.getRootSSHKey());
      const errors = await cancellablePromise(usersClient.getValidationErrors());

      updateStatus({ user, rootPasswordSet, rootSSHKey, errors, busy: false });
    };

    loadData();

    return usersClient.onValidationChange(
      (errors) => updateStatus({ errors })
    );
  }, [usersClient, cancellablePromise]);

  const errors = showErrors ? state.errors : [];

  const SectionContent = () => {
    if (state.busy) {
      return "Retrieving users summary...";
    }

    const userIsDefined = state.user?.userName !== "";

    const summary = [];

    if (userIsDefined) {
      summary.push(`User \`${state.user.userName}\` will be created`);
    } else {
      summary.push("No user defined yet");
    }

    if (state.rootPasswordSet) {
      summary.push("Root password is set");
    } else {
      summary.push("Root password is not set");
    }

    return summary.map((sentence, idx) => <Text key={idx}>{sentence}</Text>);
  };

  return (
    <Section
      key="users-section"
      title="Users"
      iconName={ state.busy ? "loading" : "manage_accounts" }
      errors={errors}
    >
      <SectionContent />
    </Section>
  );
}
