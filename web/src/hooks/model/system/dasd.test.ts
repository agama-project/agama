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
import type { DASD } from "~/model/system";

const dasdSystem: DASD.System = {
  devices: [
    {
      channel: "0.0.0100",
      deviceName: "dasda",
      type: "ECKD",
      diag: false,
      accessType: "diag",
      partitionInfo: "1",
      status: "active",
      active: true,
      formatted: true,
    },
  ],
};

describe("~/hooks/model/system/dasd", () => {
  beforeEach(() => {
    clearMockedQueries();
  });

  describe("useSystem", () => {
    it("returns the DASD system", () => {
      mockSystemQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
        dasd: dasdSystem,
      });

      const { result } = renderHook(() => useSystem());

      expect(result.current).toEqual(dasdSystem);
    });

    it("returns null if there is no system", () => {
      mockSystemQuery(null);

      const { result } = renderHook(() => useSystem());

      expect(result.current).toBeNull();
    });

    it("returns null if threre is no DASD system", () => {
      mockSystemQuery({
        product: { id: "sle", mode: "standard", registrationCode: "" },
      });

      const { result } = renderHook(() => useSystem());

      expect(result.current).toBeNull();
    });
  });
});
