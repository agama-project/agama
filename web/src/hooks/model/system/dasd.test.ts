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
// NOTE: check notes about mockSystemQuery in its documentation
import { clearMockedQueries, mockSystemQuery } from "~/test-utils/tanstack-query";
import { useSystem } from "~/hooks/model/system/dasd";
import type { Device } from "~/model/config/dasd";

const mockDeviceOffline: Device = { channel: "0.0.0150", state: "offline" as const };
const mockDeviceActive: Device = { channel: "0.0.0160", state: "active" as const };

describe("~/hooks/model/system/dasd", () => {
  beforeEach(() => {
    clearMockedQueries();
  });

  describe("useSystem", () => {
    it("returns only dasd system data, not the full system object", () => {
      mockSystemQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
        dasd: {
          devices: [mockDeviceActive, mockDeviceOffline],
        },
      });

      const { result } = renderHook(() => useSystem());

      expect(result.current).toEqual({ devices: [mockDeviceActive, mockDeviceOffline] });
      expect(result.current).not.toHaveProperty("product");
    });

    it("returns undefined when system data is undefined", () => {
      mockSystemQuery(undefined);

      const { result } = renderHook(() => useSystem());

      expect(result.current).toBeUndefined();
    });

    it("returns undefined when dasd property is not present", () => {
      mockSystemQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
      });

      const { result } = renderHook(() => useSystem());

      expect(result.current).toBeUndefined();
    });
  });
});
