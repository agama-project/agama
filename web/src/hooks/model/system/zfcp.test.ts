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
import { useSystem } from "~/hooks/model/system/zfcp";
import type { ZFCP } from "~/model/system";

const mockDevice1: ZFCP.Device = {
  channel: "0.0.5000",
  wwpn: "0x500507630510c1e3",
  lun: "0x4010404900000000",
  active: false,
};
const mockDevice2: ZFCP.Device = {
  channel: "0.0.6000",
  wwpn: "0x500507630510c1e4",
  lun: "0x4010404900000001",
  active: false,
};

describe("~/hooks/model/system/zfcp", () => {
  beforeEach(() => {
    clearMockedQueries();
  });

  describe("useSystem", () => {
    it("returns only zfcp system data, not the full system object", () => {
      mockSystemQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
        zfcp: {
          devices: [mockDevice1, mockDevice2],
        },
      });

      const { result } = renderHook(() => useSystem());

      expect(result.current).toEqual({ devices: [mockDevice1, mockDevice2] });
      expect(result.current).not.toHaveProperty("product");
    });

    it("returns null when system data is undefined", () => {
      mockSystemQuery(undefined);

      const { result } = renderHook(() => useSystem());

      expect(result.current).toBeNull();
    });

    it("returns null when zfcp property is not present", () => {
      mockSystemQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
      });

      const { result } = renderHook(() => useSystem());

      expect(result.current).toBeNull();
    });
  });
});
