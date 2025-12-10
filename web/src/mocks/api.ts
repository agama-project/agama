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

import * as apiStorage from "~/model/storage";
import * as apiIssues from "~/api/issues";
import { Device } from "~/api/storage/types/openapi";

export type ApiData = {
  "/api/storage/devices/available_drives"?: Awaited<
    ReturnType<typeof apiStorage.fetchAvailableDrives>
  >;
  "/api/storage/devices/available_md_raids"?: Awaited<
    ReturnType<typeof apiStorage.fetchAvailableMdRaids>
  >;
  "/api/storage/devices/system"?: Device[];
  "/api/storage/config_model"?: Awaited<ReturnType<typeof apiStorage.fetchConfigModel>>;
  "/api/storage/issues"?: Awaited<ReturnType<typeof apiIssues.fetchIssues>>;
};

/**
 * Mocked data.
 */
const mockApiData = jest.fn().mockReturnValue({});

/**
 *  Allows mocking data from the HTTP API.
 *
 * @example
 *    mockApi({
 *      "/api/storage/available_devices": [50, 64]
 *    })
 */
const mockApi = (data: ApiData) => mockApiData.mockReturnValue(data);

const addMockApi = (data: ApiData) => mockApi({ ...mockApiData(), ...data });

// Mock get calls.
jest.mock("~/api/http", () => ({
  ...jest.requireActual("~/api/http"),
  get: (url: string) => {
    const data = mockApiData()[url];
    return Promise.resolve(data);
  },
}));

export { mockApi, addMockApi };
