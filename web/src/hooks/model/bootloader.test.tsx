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
import { useIsTpmAvailable } from "./bootloader";
import type { Bootloader } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";
import type { System } from "~/model/system";

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

  describe("useIsTpmAvailable", () => {
    it("returns true when system and bootloader support TPM", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [
          { type: "grub2", encryptionAuth: ["password", "tpm"] },
          { type: "systemd-boot", encryptionAuth: ["password", "tpm"] },
        ],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(true);
    });

    it("returns false when bootloader does not support TPM", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [
          { type: "grub2", encryptionAuth: ["password"] },
          { type: "systemd-boot", encryptionAuth: ["password", "tpm"] },
        ],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when system is null", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      queryClient.setQueryData(["system"], null);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when bootloader system is null", () => {
      const system: System = {};

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when config is null", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], null);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when bootloader type is not configured", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      const config: ConfigModel.Config = {
        boot: { configure: true },
      };

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when boot is not configured", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      const config: ConfigModel.Config = {};

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns true for systemd-boot with TPM support", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [
          { type: "grub2", encryptionAuth: ["password"] },
          { type: "systemd-boot", encryptionAuth: ["password", "tpm"] },
        ],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "systemd-boot" },
      };

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(true);
    });

    it("returns false when bootloader type is not in available bootloaders", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "systemd-boot" },
      };

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns true for grub2-bls with TPM support", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [
          { type: "grub2", encryptionAuth: ["password"] },
          { type: "grub2-bls", encryptionAuth: ["password", "tpm"] },
        ],
      };

      const system: System = {
        bootloader: bootloaderSystem,
      };

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2-bls" },
      };

      queryClient.setQueryData(["system"], system);
      queryClient.setQueryData(["storageModel"], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(true);
    });
  });
});
