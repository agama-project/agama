/*
 * Copyright (c) [2024-2025] SUSE LLC
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
  useQuery,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import {
  AddonInfo,
  Conflict,
  License,
  Pattern,
  PatternsSelection,
  Product,
  RegisteredAddonInfo,
  RegistrationInfo,
  Repository,
  SelectedBy,
  SoftwareConfig,
  SoftwareProposal,
} from "~/types/software";
import {
  fetchAddons,
  fetchConfig,
  fetchConflicts,
  fetchLicenses,
  fetchPatterns,
  fetchProducts,
  fetchProposal,
  fetchRegisteredAddons,
  fetchRegistration,
  fetchRepositories,
  probe,
  registerAddon,
  solveConflict,
  updateConfig,
} from "~/model/software";
import { QueryHookOptions } from "~/types/queries";
import { probe as systemProbe } from "~/model/manager";

/**
 * Query to retrieve software configuration
 */
const configQuery = () => ({
  queryKey: ["software", "config"],
  queryFn: fetchConfig,
});

/**
 * Query to retrieve current software proposal
 */
const proposalQuery = () => ({
  queryKey: ["software", "proposal"],
  queryFn: fetchProposal,
});

/**
 * Query to retrieve selected product
 */
const selectedProductQuery = () => ({
  queryKey: ["software", "selectedProduct"],
  queryFn: () => fetchConfig().then(({ product }) => product),
  staleTime: Infinity,
});

/**
 * Query to retrieve available products
 */
const productsQuery = () => ({
  queryKey: ["software", "products"],
  queryFn: fetchProducts,
  staleTime: Infinity,
});

/**
 * Query to retrieve available licenses
 */
const licensesQuery = () => ({
  queryKey: ["software", "licenses"],
  queryFn: fetchLicenses,
  staleTime: Infinity,
});

/**
 * Query to retrieve registration info
 */
const registrationQuery = () => ({
  queryKey: ["software", "registration"],
  queryFn: fetchRegistration,
});

/**
 * Query to retrieve available addons info
 */
const addonsQuery = () => ({
  queryKey: ["software", "registration", "addons"],
  queryFn: fetchAddons,
});

/**
 * Query to retrieve registered addons info
 */
const registeredAddonsQuery = () => ({
  queryKey: ["software", "registration", "addons", "registered"],
  queryFn: fetchRegisteredAddons,
});

/**
 * Query to retrieve available patterns
 */
const patternsQuery = () => ({
  queryKey: ["software", "patterns"],
  queryFn: fetchPatterns,
});

/**
 * Query to retrieve configured repositories
 */
const repositoriesQuery = () => ({
  queryKey: ["software", "repositories"],
  queryFn: fetchRepositories,
});

/**
 * Query to retrieve conflicts
 */
const conflictsQuery = () => ({
  queryKey: ["software", "conflicts"],
  queryFn: fetchConflicts,
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
    onSuccess: async (_, config: SoftwareConfig) => {
      queryClient.invalidateQueries({ queryKey: ["software", "config"] });
      queryClient.invalidateQueries({ queryKey: ["software", "proposal"] });
      if (config.product) {
        queryClient.invalidateQueries({ queryKey: ["software", "selectedProduct"] });
        await systemProbe();
        queryClient.invalidateQueries({ queryKey: ["storage"] });
      }
    },
  };
  return useMutation(query);
};

/**
 * Hook that builds a mutation for registering an addon
 *
 */
const useRegisterAddonMutation = () => {
  const queryClient = useQueryClient();

  const query = {
    mutationFn: registerAddon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: registeredAddonsQuery().queryKey });
    },
  };
  return useMutation(query);
};

/**
 * Hook that builds a mutation for reloading repositories
 */
const useRepositoryMutation = (callback: () => void) => {
  const queryClient = useQueryClient();

  const query = {
    mutationFn: probe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["software", "repositories"] });
      callback();
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
    { data: product, isPending: isSelectedProductPending },
    { data: products, isPending: isProductsPending },
  ] = func({
    queries: [selectedProductQuery(), productsQuery()],
  }) as [{ data: SoftwareConfig; isPending: boolean }, { data: Product[]; isPending: boolean }];

  if (isSelectedProductPending || isProductsPending) {
    return {
      products: [],
      selectedProduct: undefined,
    };
  }

  const selectedProduct = products.find((p: Product) => p.id === product);
  return {
    products,
    selectedProduct,
  };
};

/**
 * Returns available products and selected one, if any
 */
const useLicenses = (): { licenses: License[]; isPending: boolean } => {
  const { data: licenses, isPending } = useQuery(licensesQuery());
  return { licenses, isPending };
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
const useSoftwareProposal = (): SoftwareProposal => {
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
 * Returns details about the available addons
 */
const useAddons = (): AddonInfo[] => {
  const { data: addons } = useSuspenseQuery(addonsQuery());
  return addons;
};

/**
 * Returns list of registered addons
 */
const useRegisteredAddons = (): RegisteredAddonInfo[] => {
  const { data: addons } = useSuspenseQuery(registeredAddonsQuery());
  return addons;
};

/**
 * Returns repository info
 */
const useRepositories = (): Repository[] => {
  const { data: repositories } = useSuspenseQuery(repositoriesQuery());
  return repositories;
};

/**
 * Returns conclifts info
 */
const useConflicts = (): Conflict[] => {
  const { data: conflicts } = useSuspenseQuery(conflictsQuery());
  return conflicts;
};

/**
 * Hook that builds a mutation for solving a conflict
 */
const useConflictsMutation = () => {
  const queryClient = useQueryClient();

  const query = {
    mutationFn: solveConflict,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: conflictsQuery().queryKey });
    },
  };
  return useMutation(query);
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
        queryClient.invalidateQueries({ queryKey: ["software"] });
      }

      if (event.type === "LocaleChanged") {
        queryClient.invalidateQueries({ queryKey: ["software", "products"] });
      }
    });
  }, [client, queryClient]);
};

/**
 * Hook that returns a useEffect to listen for software proposal changes
 *
 * When the selected patterns change, it invalidates the proposal query.
 */
const useSoftwareProposalChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "SoftwareProposalChanged") {
        queryClient.invalidateQueries({ queryKey: ["software", "proposal"] });
      }
    });
  }, [client, queryClient]);
};

/**
 * Hook that registers a useEffect to listen for conflicts changes
 *
 */
const useConflictsChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "ConflictsChanged") {
        const { conflicts } = event;
        queryClient.setQueryData([conflictsQuery().queryKey], conflicts);
      }
    });
  });
};

export {
  configQuery,
  productsQuery,
  useAddons,
  useConfigMutation,
  useConflicts,
  useConflictsMutation,
  useConflictsChanges,
  useLicenses,
  usePatterns,
  useProduct,
  useProductChanges,
  useSoftwareProposal,
  useSoftwareProposalChanges,
  useRegisterAddonMutation,
  useRegisteredAddons,
  useRegistration,
  useRepositories,
  useRepositoryMutation,
};
