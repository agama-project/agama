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

import { renderHook } from "@testing-library/react";
import { clearMockedQueries, mockSystemQuery } from "~/test-utils/tanstack-query";
import { useSystem, useControllers, useDevices, useCheckLunScan } from "~/hooks/model/system/zfcp";
import type { ZFCP } from "~/model/system";

const zfcpSystem: ZFCP.System = {
  lunScan: true,
  controllers: [
    {
      channel: "0.0.7000",
      wwpns: ["0x500507630303c5f9"],
      lunScan: true,
      active: true,
    },
  ],
  devices: [
    {
      channel: "0.0.7000",
      wwpn: "0x500507630303c5f9",
      lun: "0x5022000000000000",
      active: true,
      deviceName: "/dev/sda",
    },
    {
      channel: "0.0.5000",
      wwpn: "0x500507630510c1e3",
      lun: "0x4010404900000000",
      active: false,
    },
  ],
};

describe("~/hooks/model/system/zfcp", () => {
  beforeEach(() => {
    clearMockedQueries();
  });

  describe("useSystem", () => {
    it("returns the zFCP system", () => {
      mockSystemQuery({
        zfcp: { ...zfcpSystem },
      });

      const { result } = renderHook(() => useSystem());

      expect(result.current).toEqual(zfcpSystem);
    });

    it("returns null if there is no system", () => {
      mockSystemQuery(null);

      const { result } = renderHook(() => useSystem());

      expect(result.current).toBeNull();
    });

    it("returns null if there is no zFCP system", () => {
      mockSystemQuery({});

      const { result } = renderHook(() => useSystem());

      expect(result.current).toBeNull();
    });
  });

  describe("useControllers", () => {
    it("returns the zFCP controllers", () => {
      mockSystemQuery({
        zfcp: { ...zfcpSystem },
      });

      const { result } = renderHook(() => useControllers());

      expect(result.current).toEqual(zfcpSystem.controllers);
    });

    it("returns an empty list if there is no system", () => {
      mockSystemQuery(null);

      const { result } = renderHook(() => useControllers());

      expect(result.current).toEqual([]);
    });

    it("returns an empty list if there is no zFCP system", () => {
      mockSystemQuery({});

      const { result } = renderHook(() => useControllers());

      expect(result.current).toEqual([]);
    });

    it("returns an empty list if there are no zFCP controllers", () => {
      mockSystemQuery({
        zfcp: {},
      });

      const { result } = renderHook(() => useControllers());

      expect(result.current).toEqual([]);
    });
  });

  describe("useDevices", () => {
    it("returns the zFCP devices", () => {
      mockSystemQuery({
        zfcp: { ...zfcpSystem },
      });

      const { result } = renderHook(() => useDevices());

      expect(result.current).toEqual(zfcpSystem.devices);
    });

    it("returns an empty list if there is no system", () => {
      mockSystemQuery(null);

      const { result } = renderHook(() => useDevices());

      expect(result.current).toEqual([]);
    });

    it("returns an empty list if there is no zFCP system", () => {
      mockSystemQuery({});

      const { result } = renderHook(() => useDevices());

      expect(result.current).toEqual([]);
    });

    it("returns an empty list if there are no zFCP devices", () => {
      mockSystemQuery({
        zfcp: {},
      });

      const { result } = renderHook(() => useDevices());

      expect(result.current).toEqual([]);
    });
  });

  describe("useCheckLunScan", () => {
    it("returns false if LUN Scan is not active in the system", () => {
      mockSystemQuery({
        zfcp: { ...zfcpSystem, lunScan: false },
      });

      const { result } = renderHook(() => useCheckLunScan());

      expect(result.current("0.0.7000")).toEqual(false);
    });

    it("returns false if LUN Scan is not supported by the controller", () => {
      mockSystemQuery({
        zfcp: {
          lunScan: true,
          controllers: [
            {
              channel: "0.0.7000",
              wwpns: ["0x500507630303c5f9"],
              lunScan: false,
              active: true,
            },
          ],
        },
      });

      const { result } = renderHook(() => useCheckLunScan());

      expect(result.current("0.0.7000")).toEqual(false);
    });

    it("returns false if the controller does not exist", () => {
      mockSystemQuery({
        zfcp: { ...zfcpSystem },
      });

      const { result } = renderHook(() => useCheckLunScan());

      expect(result.current("0.0.8000")).toEqual(false);
    });

    it("returns true if LUN scan is active and supported by the controller", () => {
      mockSystemQuery({
        zfcp: {
          lunScan: true,
          controllers: [
            {
              channel: "0.0.7000",
              wwpns: ["0x500507630303c5f9"],
              lunScan: true,
              active: true,
            },
          ],
        },
      });

      const { result } = renderHook(() => useCheckLunScan());

      expect(result.current("0.0.7000")).toEqual(true);
    });
  });
});
