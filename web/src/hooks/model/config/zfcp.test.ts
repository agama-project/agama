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
import { clearMockedQueries, mockConfigQuery } from "~/test-utils/tanstack-query";
import { patchConfig } from "~/api";
import { useConfig, useAddControllers, useAddDevices } from "~/hooks/model/config/zfcp";
import type { ZFCP } from "~/model/config";

const mockDevice1: ZFCP.Device = {
  channel: "0.0.5000",
  wwpn: "0x500507630510c1e3",
  lun: "0x4010404900000000",
};
const mockDevice2: ZFCP.Device = {
  channel: "0.0.5000",
  wwpn: "0x500507630510c1e3",
  lun: "0x4010404900000001",
};
const mockDevice3: ZFCP.Device = {
  channel: "0.0.6000",
  wwpn: "0x500507630510c1e4",
  lun: "0x4010404900000000",
};

const mockPatchConfig = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config: Parameters<typeof patchConfig>) => mockPatchConfig(config),
}));

describe("hooks/model/storage/zfcp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMockedQueries();
  });

  describe("useConfig", () => {
    it("returns only zfcp config data", () => {
      mockConfigQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
        zfcp: { devices: [mockDevice1] },
      });

      const { result } = renderHook(() => useConfig());

      expect(result.current).toEqual({ devices: [mockDevice1] });
      expect(result.current).not.toHaveProperty("product");
    });

    it("returns null when config data is undefined", () => {
      mockConfigQuery(undefined);

      const { result } = renderHook(() => useConfig());

      expect(result.current).toBeNull();
    });

    it("returns null when zfcp property is not present", () => {
      mockConfigQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
      });

      const { result } = renderHook(() => useConfig());

      expect(result.current).toBeNull();
    });
  });

  describe("useAddControllers", () => {
    describe("when there is not a zFCP config yet", () => {
      it("calls API#patchConfig with a new config including the given controllers", async () => {
        mockConfigQuery(null);

        const { result } = renderHook(() => useAddControllers());

        await act(async () => {
          result.current(["0.0.5000"]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({ controllers: ["0.0.5000"] }),
        });
      });
    });

    describe("when there is an existing zFCP config without controllers", () => {
      it("calls API#patchConfig with the given controllers added", async () => {
        mockConfigQuery({ zfcp: {} });

        const { result } = renderHook(() => useAddControllers());

        await act(async () => {
          result.current(["0.0.5000"]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({ controllers: ["0.0.5000"] }),
        });
      });
    });

    describe("when there is an existing zFCP config with controllers", () => {
      it("adds new controllers to existing ones", async () => {
        mockConfigQuery({ zfcp: { controllers: ["0.0.5000"] } });

        const { result } = renderHook(() => useAddControllers());

        await act(async () => {
          result.current(["0.0.6000"]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({
            controllers: ["0.0.5000", "0.0.6000"],
          }),
        });
      });

      it("does not duplicate controllers already present", async () => {
        mockConfigQuery({ zfcp: { controllers: ["0.0.5000"] } });

        const { result } = renderHook(() => useAddControllers());

        await act(async () => {
          result.current(["0.0.5000", "0.0.6000"]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({
            controllers: ["0.0.5000", "0.0.6000"],
          }),
        });
      });
    });
  });

  describe("useAddDevices", () => {
    describe("when there is not a zFCP config yet", () => {
      it("calls API#patchConfig with a new config including the given devices", async () => {
        mockConfigQuery(null);

        const { result } = renderHook(() => useAddDevices());

        await act(async () => {
          result.current([mockDevice1]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({ devices: [mockDevice1] }),
        });
      });
    });

    describe("when there is an existing zFCP config without devices", () => {
      it("calls API#patchConfig with the given devices added", async () => {
        mockConfigQuery({ zfcp: {} });

        const { result } = renderHook(() => useAddDevices());

        await act(async () => {
          result.current([mockDevice1]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({ devices: [mockDevice1] }),
        });
      });
    });

    describe("when there is an existing zFCP config with devices", () => {
      it("adds new devices to existing ones", async () => {
        mockConfigQuery({ zfcp: { devices: [mockDevice1] } });

        const { result } = renderHook(() => useAddDevices());

        await act(async () => {
          result.current([mockDevice2]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({
            devices: [mockDevice1, mockDevice2],
          }),
        });
      });

      it("updates an existing device when channel, wwpn, and lun match", async () => {
        mockConfigQuery({ zfcp: { devices: [mockDevice1, mockDevice2] } });

        const updatedDevice: ZFCP.Device = { ...mockDevice1 };
        const { result } = renderHook(() => useAddDevices());

        await act(async () => {
          result.current([updatedDevice]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({
            devices: [updatedDevice, mockDevice2],
          }),
        });
      });

      it("handles a mix of new and updated devices", async () => {
        mockConfigQuery({ zfcp: { devices: [mockDevice1, mockDevice2] } });

        const updatedDevice: ZFCP.Device = { ...mockDevice1 };
        const { result } = renderHook(() => useAddDevices());

        await act(async () => {
          result.current([updatedDevice, mockDevice3]);
        });

        expect(mockPatchConfig).toHaveBeenCalledWith({
          zfcp: expect.objectContaining({
            devices: [updatedDevice, mockDevice2, mockDevice3],
          }),
        });
      });
    });
  });
});
