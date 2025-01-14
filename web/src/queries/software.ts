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
import {
  useMutation,
  useQueries,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import {
  Pattern,
  PatternsSelection,
  Product,
  RegistrationInfo,
  Repository,
  SelectedBy,
  SoftwareConfig,
  SoftwareProposal,
} from "~/types/software";
import {
  fetchConfig,
  fetchPatterns,
  fetchProducts,
  fetchProposal,
  fetchRegistration,
  fetchRepositories,
  register,
  updateConfig,
} from "~/api/software";
import { QueryHookOptions } from "~/types/queries";
import { startProbing } from "~/api/manager";

/**
 * Query to retrieve software configuration
 */
const configQuery = () => ({
  queryKey: ["software/config"],
  queryFn: fetchConfig,
});

/**
 * Query to retrieve current software proposal
 */
const proposalQuery = () => ({
  queryKey: ["software/proposal"],
  queryFn: fetchProposal,
});

/**
 * Query to retrieve available products
 */
const productsQuery = () => ({
  queryKey: ["software/products"],
  queryFn: fetchProducts,
  staleTime: Infinity,
});

/**
 * Query to retrieve selected product
 */
const selectedProductQuery = () => ({
  queryKey: ["software/product"],
  queryFn: () => fetchConfig().then(({ product }) => product),
});

/**
 * Query to retrieve registration info
 */
const registrationQuery = () => ({
  queryKey: ["software/registration"],
  queryFn: fetchRegistration,
});

/**
 * Query to retrieve available patterns
 */
const patternsQuery = () => ({
  queryKey: ["software/patterns"],
  queryFn: fetchPatterns,
});

/**
 * Query to retrieve configured repositories
 */
const repositoriesQuery = () => ({
  queryKey: ["software/repositories"],
  queryFn: fetchRepositories,
});

/**
 * Hook that builds a mutation to update the software configuration
 *
 * @note it would trigger a general probing as a side-effect when mutation
 * includes a product.
 */
const useConfigMutation = () => {
  const queryClient = useQueryClient();

  const query = {
    mutationFn: updateConfig,
    onSuccess: (_, config: SoftwareConfig) => {
      queryClient.invalidateQueries({ queryKey: ["software/config"] });
      queryClient.invalidateQueries({ queryKey: ["software/proposal"] });
      if (config.product) {
        queryClient.invalidateQueries({ queryKey: ["software/product"] });
        startProbing();
      }
    },
  };
  return useMutation(query);
};

/**
 * Hook that builds a mutation for registering a product
 *
 * @note it would trigger a general probing as a side-effect when mutation
 * includes a product.
 */
const useRegisterMutation = () => {
  const queryClient = useQueryClient();

  const query = {
    mutationFn: register,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["software/registration"] });
      startProbing();
    },
  };
  return useMutation(query);
};

/**
 * Returns available products and selected one, if any
 */
const useProduct = (
  options?: QueryHookOptions,
): { products?: Product[]; selectedProduct?: Product } => {
  const func = options?.suspense ? useSuspenseQueries : useQueries;
  const [
    { data: selected, isPending: isSelectedPending },
    { data: products, isPending: isProductsPending },
  ] = func({
    queries: [selectedProductQuery(), productsQuery()],
  }) as [{ data: string; isPending: boolean }, { data: Product[]; isPending: boolean }];

  if (isSelectedPending || isProductsPending) {
    return {};
  }

  const selectedProduct = products.find((p: Product) => p.id === selected);
  return {
    products,
    selectedProduct,
  };
};

/**
 * Returns a list of patterns with their selectedBy property properly set based on current proposal.
 */
const usePatterns = (): Pattern[] => {
  const [{ data: proposal }, { data: patterns }] = useSuspenseQueries({
    queries: [proposalQuery(), patternsQuery()],
  });

  const selection: PatternsSelection = proposal.patterns;

  return patterns
    .map((pattern: Pattern): Pattern => {
      let selectedBy: SelectedBy;
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
      return { ...pattern, selectedBy };
    })
    .sort((a: Pattern, b: Pattern) => a.order - b.order);
};

/**
 * Returns current software proposal
 */
const useProposal = (): SoftwareProposal => {
  const { data: proposal } = useSuspenseQuery(proposalQuery());
  return proposal;
};

/**
 * Returns registration info
 */
const useRegistration = (): RegistrationInfo => {
  const { data: registration } = useSuspenseQuery(registrationQuery());
  return registration;
};

/**
 * Returns repository info
 */
const useRepositories = (): Repository[] => {
  const { data: repositories } = useSuspenseQuery(repositoriesQuery());
  return repositories;
};

/**
 * Hook that returns a useEffect to listen for  software proposal events
 *
 * When the configuration changes, it invalidates the config query.
 */
const useProductChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "ProductChanged") {
        queryClient.invalidateQueries({ queryKey: ["software/config"] });
      }

      if (event.type === "LocaleChanged") {
        queryClient.invalidateQueries({ queryKey: ["software/products"] });
      }
    });
  }, [client, queryClient]);
};

/**
 * Hook that returns a useEffect to listen for software proposal changes
 *
 * When the selected patterns change, it invalidates the proposal query.
 */
const useProposalChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "SoftwareProposalChanged") {
        queryClient.invalidateQueries({ queryKey: ["software/proposal"] });
      }
    });
  }, [client, queryClient]);
};

export {
  configQuery,
  productsQuery,
  selectedProductQuery,
  useConfigMutation,
  usePatterns,
  useProduct,
  useProductChanges,
  useProposal,
  useProposalChanges,
  useRegistration,
  useRegisterMutation,
  useRepositories,
};
