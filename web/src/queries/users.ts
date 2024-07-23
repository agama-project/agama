/*
 * Copyright (c) [2024] SUSE LLC
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
import { QueryClient, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";
import { FirstUser, RootUser, RootUserChanges } from "~/types/users";

/**
 * Returns a query for retrieving the first user configuration
 */
const firstUserQuery = () => ({
  queryKey: ["users", "firstUser"],
  queryFn: () => fetch("/api/users/first").then((res) => res.json()),
});

/**
 * Hook that returns the first user.
 */
const useFirstUser = () => {
  const { data: firstUser } = useSuspenseQuery(firstUserQuery());
  return firstUser;
};

/*
 * Hook that returns a mutation to change the first user.
 */
const useFirstUserMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (user: FirstUser) =>
      fetch("/api/users/first", {
        method: "PUT",
        body: JSON.stringify({ ...user, data: {} }),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error(_("Please, try again"));
        }
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "firstUser"] }),
  };
  return useMutation(query);
};

const useRemoveFirstUserMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: () =>
      fetch("/api/users/first", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "firstUser"] });
    },
  };
  return useMutation(query);
};

/**
 * Listens for first user changes.
 */
const useFirstUserChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent((event) => {
      if (event.type === "FirstUserChanged") {
        const { fullName, userName, password, autologin, data } = event;
        queryClient.setQueryData(["users", "firstUser"], {
          fullName,
          userName,
          password,
          autologin,
          data,
        });
      }
    });
  });
};

/**
 * Returns a query for retrieving the root user configuration.
 */
const rootUserQuery = () => ({
  queryKey: ["users", "root"],
  queryFn: () => fetch("/api/users/root").then((res) => res.json()),
});

const useRootUser = () => {
  const { data: rootUser } = useSuspenseQuery(rootUserQuery());
  return rootUser;
};

/*
 * Hook that returns a mutation to change the root user configuration.
 */
const useRootUserMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (changes: Partial<RootUserChanges>) =>
      fetch("/api/users/root", {
        method: "PATCH",
        body: JSON.stringify({ ...changes, passwordEncrypted: false }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "root"] }),
  };
  return useMutation(query);
};

/**
 * Listens for first user changes.
 */
const useRootUserChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent((event) => {
      console.log("event.type", event.type);
      if (event.type === "RootChanged") {
        const { password, sshkey } = event;
        queryClient.setQueryData(["users", "root"], (oldRoot: RootUser) => {
          const newRoot = { ...oldRoot };
          if (password !== undefined) {
            newRoot.password = password;
          }

          if (sshkey) {
            newRoot.sshkey = sshkey;
          }

          return newRoot;
        });
      }
    });
  });
};

export {
  useFirstUser,
  useFirstUserChanges,
  useFirstUserMutation,
  useRemoveFirstUserMutation,
  useRootUser,
  useRootUserChanges,
  useRootUserMutation,
};
