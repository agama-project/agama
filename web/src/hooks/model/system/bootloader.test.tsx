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

import React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSystem } from "./bootloader";
import type { System } from "~/model/system";
import type { Bootloader } from "~/model/system";

describe("bootloader hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useSystem", () => {
    it("returns bootloader system when available", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [
          { type: "grub2", encryptionAuth: ["password", "tpm"] },
          { type: "grub2-bls", encryptionAuth: ["password", "tpm"] },
        ],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      queryClient.setQueryData(["system"], system);

      const { result } = renderHook(() => useSystem(), { wrapper });

      expect(result.current).toEqual(bootloaderSystem);
    });

    it("returns null when system has no bootloader", () => {
      const system: System = {};

      queryClient.setQueryData(["system"], system);

      const { result } = renderHook(() => useSystem(), { wrapper });

      expect(result.current).toBeNull();
    });

    it("returns null when system is null", () => {
      queryClient.setQueryData(["system"], null);

      const { result } = renderHook(() => useSystem(), { wrapper });

      expect(result.current).toBeNull();
    });
  });
});
