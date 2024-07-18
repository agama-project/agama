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
import { SelectedBy } from "~/client/software";

const configQuery = () => ({
  queryKey: ["software/config"],
  queryFn: () => fetch("/api/software/config").then((res) => res.json()),
});

const selectedProductQuery = () => ({
  queryKey: ["software/product"],
  queryFn: async () => {
    const response = await fetch("/api/software/config");
    const { product } = await response.json();
    return product;
  },
});

const productsQuery = () => ({
  queryKey: ["software/products"],
  queryFn: () => fetch("/api/software/products").then((res) => res.json()),
  staleTime: Infinity,
});

const proposalQuery = () => ({
  queryKey: ["software/proposal"],
  queryFn: () => fetch("/api/software/proposal").then((res) => res.json()),
});

const patternsQuery = () => ({
  queryKey: ["software/patterns"],
  queryFn: () => fetch("/api/software/patterns").then((res) => res.json()),
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
    onMutate: async () => {
      const prevConfig = queryClient.getQueryData(["software/config"]);
      return { prevConfig };
    },
    onSuccess: (_, variables, { prevConfig }) => {
      queryClient.invalidateQueries({ queryKey: ["software/config"] });
      queryClient.invalidateQueries({ queryKey: ["software/proposal"] });
      if (variables.product && variables.product !== prevConfig.product) {
        queryClient.invalidateQueries({ queryKey: ["software/product"] });
        client.manager.startProbing();
      }
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
  const [{ data: selected }, { data: products }] = useSuspenseQueries({
    queries: [selectedProductQuery(), productsQuery()],
  });

  const selectedProduct = products.find((p) => p.id === selected);
  return {
    products,
    selectedProduct,
  };
};

const usePatterns = () => {
  const [{ data: proposal }, { data: patterns }] = useSuspenseQueries({
    queries: [proposalQuery(), patternsQuery()],
  });

  // const selection: PatternsSelection = config.patterns;
  const selection = proposal.patterns;

  return patterns
    .map((pattern) => {
      let selectedBy;
      switch (selection[pattern.name]) {
        case 0:
          selectedBy = SelectedBy.USER;
          break;
        case 1:
          selectedBy = SelectedBy.AUTO;
          break;
        default:
          selectedBy = SelectedBy.NONE;
      }
      return {
        ...pattern,
        selectedBy,
      };
    })
    .sort((a, b) => a.order - b.order);
};

export {
  configQuery,
  productsQuery,
  selectedProductQuery,
  useConfigMutation,
  usePatterns,
  useProduct,
  useProductChanges,
};
