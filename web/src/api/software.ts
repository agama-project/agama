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

import {
  Pattern,
  Product,
  SoftwareConfig,
  RegistrationInfo,
  Repository,
  SoftwareProposal,
} from "~/types/software";
import { get, post, put } from "~/api/http";

/**
 * Returns the software configuration
 */
const fetchConfig = (): Promise<SoftwareConfig> => get("/api/software/config");

/**
 * Returns the software proposal
 */
const fetchProposal = (): Promise<SoftwareProposal> => get("/api/software/proposal");

/**
 * Returns the list of known products
 */
const fetchProducts = (): Promise<Product[]> => get("/api/software/products");

/**
 * Returns an object with the registration info
 */
const fetchRegistration = (): Promise<RegistrationInfo> => get("/api/software/registration");

/**
 * Returns the list of patterns for the selected product
 */
const fetchPatterns = (): Promise<Pattern[]> => get("/api/software/patterns");

/**
 * Returns the list of configured repositories
 */
const fetchRepositories = (): Promise<Repository[]> => get("/api/software/repositories");

/**
 * Updates the software configuration
 *
 * @param config - New software configuration
 */
const updateConfig = (config: SoftwareConfig) => put("/api/software/config", config);

/**
 * Request registration of selected product with given key
 */
const register = ({ key, email }: { key: string; email?: string }) =>
  post("/api/software/registration", { key, email });

export {
  fetchConfig,
  fetchPatterns,
  fetchProposal,
  fetchProducts,
  fetchRegistration,
  fetchRepositories,
  updateConfig,
  register,
};
