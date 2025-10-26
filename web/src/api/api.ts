/*
 * Copyright (c) [2025] SUSE LLC
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

import { get, patch, post } from "~/api/http";
import { Config } from "~/types/config";
import { Proposal } from "~/types/proposal";
import { System } from "~/types/system";

/**
 * Returns the system config
 */
const fetchSystem = (): Promise<System> => get("/api/v2/system");

/**
 * Returns the proposal
 */
const fetchProposal = (): Promise<Proposal> => get("/api/v2/proposal");

/**
 * Updates configuration
 */
const updateConfig = (config: Config) => patch("/api/v2/config", { update: config });
/**
 * Triggers an action
 */
const trigger = (action) => post("/api/v2/action", action);

export { fetchSystem, fetchProposal, updateConfig, trigger };
