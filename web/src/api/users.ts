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

import { del, get, patch, put } from "~/api/http";
import { FirstUser, RootUser, RootUserChanges } from "~/types/users";

/**
 * Returns the first user's definition
 */
const fetchFirstUser = (): Promise<FirstUser> => get("/api/users/first");

/**
 * Updates the first user's definition
 *
 * @param user - Full first user's definition
 */
const updateFirstUser = (user: FirstUser) => put("/api/users/first", user);

/**
 * Removes the first user definition
 */
const removeFirstUser = () => del("/api/users/first");

/**
 * Returns the root user configuration
 */
const fetchRoot = (): Promise<RootUser> => get("/api/users/root");

/**
 * Updates the root user configuration
 *
 * @param changes - Changes to apply to the root user configuration
 */
const updateRoot = (changes: Partial<RootUserChanges>) => patch("/api/users/root", changes);

export { fetchFirstUser, updateFirstUser, removeFirstUser, fetchRoot, updateRoot };
