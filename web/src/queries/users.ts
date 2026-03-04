/*
 * Copyright (c) [2024] SUSE LLC
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
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { RootUser } from "~/types/users";
import {
  fetchFirstUser,
  fetchRoot,
  removeFirstUser,
  updateFirstUser,
  updateRoot,
} from "~/model/users";

/**
 * Returns a query for retrieving the first user configuration
 */
const firstUserQuery = () => ({
  queryKey: ["users", "firstUser"],
  queryFn: fetchFirstUser,
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
    mutationFn: updateFirstUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "firstUser"] }),
  };
  return useMutation(query);
};

const useRemoveFirstUserMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: removeFirstUser,
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

    return client.onEvent((event) => {
      if (event.type === "FirstUserChanged") {
        const { fullName, userName, password, hashedPassword, autologin, data } = event;
        queryClient.setQueryData(["users", "firstUser"], {
          fullName,
          userName,
          password,
          hashedPassword,
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
  queryFn: fetchRoot,
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
    mutationFn: updateRoot,
    onMutate: async (newRoot: RootUser) => {
      await queryClient.cancelQueries({ queryKey: ["users", "root"] });

      const previousRoot: RootUser = queryClient.getQueryData(["users", "root"]);
      queryClient.setQueryData(["users", "root"], {
        password: newRoot.password,
        hashedPassword: newRoot.hashedPassword,
        sshPublicKey: newRoot.sshPublicKey || previousRoot.sshPublicKey,
      });
      return { previousRoot };
    },
    // eslint-disable-next-line n/handle-callback-err
    onError: (error, newRoot, context) => {
      queryClient.setQueryData(["users", "root"], context.previousRoot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "root"] });
    },
  };
  return useMutation(query);
};

/**
 * Listens for root user changes.
 */
const useRootUserChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "RootChanged") {
        const { password, sshPublicKey } = event;
        queryClient.setQueryData(["users", "root"], (oldRoot: RootUser) => {
          const newRoot = { ...oldRoot };
          if (password !== undefined) {
            newRoot.password = password;
            newRoot.hashedPassword = false;
          }

          if (sshPublicKey) {
            newRoot.sshPublicKey = sshPublicKey;
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
