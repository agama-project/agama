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

// @todo Move to the new API.

import {
  AddonInfo,
  Conflict,
  ConflictSolution,
  License,
  LicenseContent,
  Pattern,
  Product,
  RegisteredAddonInfo,
  RegistrationInfo,
  Repository,
  SoftwareConfig,
  SoftwareProposal,
} from "~/types/software";
import { get, patch, post, put } from "~/http";

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
 * Returns the list of available licenses
 */
const fetchLicenses = (): Promise<License[]> => get("/api/software/licenses");

/**
 * Returns the content for given license id
 */
const fetchLicense = (id: string, lang: string = "en"): Promise<LicenseContent> =>
  get(`/api/v2/licenses/${id}?lang=${lang}`);

/**
 * Returns an object with the registration info
 */
const fetchRegistration = (): Promise<RegistrationInfo> => get("/api/software/registration");

/**
 * Returns list of available addons
 */
const fetchAddons = (): Promise<AddonInfo[]> => get("/api/software/registration/addons/available");

/**
 * Returns list of already registered addons
 */
const fetchRegisteredAddons = (): Promise<RegisteredAddonInfo[]> =>
  get("/api/software/registration/addons/registered");

/**
 * Returns the list of patterns for the selected product
 */
const fetchPatterns = (): Promise<Pattern[]> => get("/api/software/patterns");

/**
 * Returns the list of configured repositories
 */
const fetchRepositories = (): Promise<Repository[]> => get("/api/software/repositories");

/**
 * Returns the list of conflicts
 */
const fetchConflicts = (): Promise<Conflict[]> => get("/api/software/conflicts");

/**
 * Updates the software configuration
 *
 * @param config - New software configuration
 */
const updateConfig = (config: SoftwareConfig) => put("/api/software/config", config);

/**
 * Updates the software configuration
 */
const probe = () => post("/api/software/probe");

/**
 * Request registration of the selected addon
 */
const registerAddon = (addon: RegisteredAddonInfo) =>
  post("/api/software/registration/addons/register", addon);

/**
 * Request for solving a conflict by applying given solution
 */
const solveConflict = (solution: ConflictSolution) => patch("/api/software/conflicts", [solution]);

export {
  fetchAddons,
  fetchConfig,
  fetchConflicts,
  fetchLicense,
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
};
