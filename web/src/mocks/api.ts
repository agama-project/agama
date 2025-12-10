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

/**
 * Mocking HTTP API calls.
 */

import { model as storageModel } from "~/api/storage";
import { System } from "~/api/system";
import { Issue } from "~/api/issue";
import { Config } from "~/api/config";
import { Proposal } from "~/api/proposal";
import { Question } from "~/api/question";
import { Status } from "~/api/status";

export type ApiData = {
  "/api/v2/status"?: Status | null;
  "/api/v2/config"?: Config | null;
  "/api/v2/extended_config"?: Config | null;
  "/api/v2/system"?: System | null;
  "/api/v2/proposal"?: Proposal | null;
  "/api/v2/issues"?: Issue[];
  "/api/v2/questions"?: Question[];
  "/api/v2/private/storage_model"?: storageModel.Config | null;
};

const mockApiData = jest.fn().mockReturnValue({});

/**
 *  Allows mocking data from the HTTP API.
 *
 * @example
 *    mockApi({
 *      "/api/v2/system": { l10n: { locales: [] } }
 *    })
 */
const mockApi = (data: ApiData) => mockApiData.mockReturnValue(data);

const addMockApi = (data: ApiData) => mockApi({ ...mockApiData(), ...data });

// Mock get calls.
jest.mock("~/http", () => ({
  ...jest.requireActual("~/http"),
  get: (url: string) => {
    const data = mockApiData()[url];
    if (data !== undefined) {
      return Promise.resolve(data);
    }
    // You can add a fallback to the actual implementation if needed
    // For example, by calling jest.requireActual("~/http").get(url)
    return Promise.reject(new Error(`No mock data for GET ${url}`));
  },
}));

export { mockApi, addMockApi };
