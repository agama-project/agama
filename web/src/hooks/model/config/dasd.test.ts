/*
 * Copyright (c) [2026] SUSE LLC
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

import { act, renderHook } from "@testing-library/react";
// NOTE: check notes about mockConfigQuery in its documentation
import { clearMockedQueries, mockConfigQuery } from "~/test-utils/tanstack-query";
import { patchConfig } from "~/api";
import { useConfig, useAddOrUpdateDevices } from "~/hooks/model/config/dasd";
import type { Device } from "~/model/config/dasd";

const mockDeviceOffline: Device = { channel: "0.0.0150", state: "offline" as const };
const mockDeviceActive: Device = { channel: "0.0.0160", state: "active" as const };
const mockDeviceToBeFormmated: Device = {
  channel: "0.0.0170",
  state: "active" as const,
  format: true,
};

const mockPatchConfig = jest.fn();

// Mock the API
jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config: Parameters<typeof patchConfig>) => mockPatchConfig(config),
}));

describe("hooks/model/storage/dasd", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMockedQueries();
  });

  describe("useConfig", () => {
    it("returns the DASD config", () => {
      mockConfigQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
        dasd: { devices: [mockDeviceActive] },
      });

      const { result } = renderHook(() => useConfig());

      expect(result.current).toEqual({ devices: [mockDeviceActive] });
      expect(result.current).not.toHaveProperty("product");
    });

    it("returns null if there is no config", () => {
      mockConfigQuery(null);

      const { result } = renderHook(() => useConfig());

      expect(result.current).toBeNull();
    });

    it("returns null if there is no DASD config", () => {
      mockConfigQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
      });

      const { result } = renderHook(() => useConfig());

      expect(result.current).toBeNull();
    });
  });

  describe("useAddOrUpdateDevices", () => {
    describe("when there is not a DASD config yet", () => {
      it("calls API#patchConfig with a new config including the given devices", async () => {
        mockConfigQuery(null);

        const { result } = renderHook(() => useAddOrUpdateDevices());

        await act(async () => {
          result.current([mockDeviceActive]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          dasd: expect.objectContaining({ devices: [mockDeviceActive] }),
        });
      });
    });

    describe("when there is an existing DASD config without devices", () => {
      it("calls API#patchConfig with the given devices added", async () => {
        mockConfigQuery({ dasd: {} });

        const { result } = renderHook(() => useAddOrUpdateDevices());

        await act(async () => {
          result.current([mockDeviceActive]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          dasd: expect.objectContaining({ devices: [mockDeviceActive] }),
        });
      });
    });

    describe("when there is an existing DASD config with devices", () => {
      it("adds new devices to existing ones", async () => {
        mockConfigQuery({ dasd: { devices: [mockDeviceOffline] } });

        const { result } = renderHook(() => useAddOrUpdateDevices());

        await act(async () => {
          result.current([mockDeviceActive]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          dasd: expect.objectContaining({
            devices: [mockDeviceOffline, mockDeviceActive],
          }),
        });
      });

      it("updates an existing device when channel matches", async () => {
        mockConfigQuery({
          dasd: { devices: [mockDeviceOffline, mockDeviceActive] },
        });

        const updatedDevice: Device = { channel: mockDeviceActive.channel, state: "offline" };
        const { result } = renderHook(() => useAddOrUpdateDevices());

        await act(async () => {
          result.current([updatedDevice]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          dasd: expect.objectContaining({
            devices: [mockDeviceOffline, updatedDevice],
          }),
        });
      });

      it("handles a mix of new and updated devices", async () => {
        mockConfigQuery({
          dasd: { devices: [mockDeviceOffline, mockDeviceActive] },
        });

        const updatedDevice: Device = { channel: mockDeviceActive.channel, state: "offline" };
        const { result } = renderHook(() => useAddOrUpdateDevices());

        await act(async () => {
          result.current([updatedDevice, mockDeviceToBeFormmated]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          dasd: expect.objectContaining({
            devices: [mockDeviceOffline, updatedDevice, mockDeviceToBeFormmated],
          }),
        });
      });
    });
  });
});
