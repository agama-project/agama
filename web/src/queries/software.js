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
import {
  QueryClient,
  useMutation,
  useQueryClient,
  useSuspenseQueries,
} from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";

const configQuery = () => ({
  queryKey: ["software/config"],
  queryFn: () => fetch("/api/software/config").then((res) => res.json()),
});

const productsQuery = () => ({
  queryKey: ["software/products"],
  queryFn: () => fetch("/api/software/products").then((res) => res.json()),
  staleTime: Infinity,
});

/**
 * Hook that builds a mutation to update the software configuration
 *
 * It does not require to call `useMutation`.
 */
const useConfigMutation = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  const query = {
    mutationFn: (newConfig) =>
      fetch("/api/software/config", {
        // FIXME: use "PATCH" instead
        method: "PUT",
        body: JSON.stringify(newConfig),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["software/config"] });
      client.manager.startProbing();
    },
  };
  return useMutation(query);
};

/**
 * Hook that returns a useEffect to listen for software events
 *
 * When the configuration changes, it invalidates the config query and forces the router to
 * revalidate its data (executing the loaders again).
 */
const useProductChanges = () => {
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;
    const queryClient = new QueryClient();

    return client.ws().onEvent((event) => {
      if (event.type === "ProductChanged") {
        queryClient.invalidateQueries({ queryKey: ["software/config"] });
      }
    });
  }, [client]);
};

const useProduct = () => {
  const [{ data: config }, { data: products }] = useSuspenseQueries({
    queries: [configQuery(), productsQuery()],
  });

  const selectedProduct = products.find((p) => p.id === config.product);
  return {
    products,
    selectedProduct,
  };
};

export { configQuery, productsQuery, useConfigMutation, useProduct, useProductChanges };
