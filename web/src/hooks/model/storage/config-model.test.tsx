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
import {
  useConfigModel,
  useSolvedConfigModel,
  useIsGrub2WithTpm,
  useIsTpmAvailable,
  useMissingMountPaths,
  useDevice,
  usePartitionable,
  useDrive,
  useMdRaid,
  useVolumeGroup,
  useSetBootDevice,
  useSetDefaultBootDevice,
  useDisableBoot,
  useSetEncryption,
  useAddDrive,
  useDeleteDrive,
  useAddMdRaid,
  useDeleteMdRaid,
  useAddVolumeGroup,
  useEditVolumeGroup,
  useDeleteVolumeGroup,
  useAddLogicalVolume,
  useEditLogicalVolume,
  useDeleteLogicalVolume,
  useAddPartition,
  useEditPartition,
  useDeletePartition,
  useSetFilesystem,
  useSetSpacePolicy,
  useConvertPartitionableToVolumeGroup,
  useConvertDevice,
  STORAGE_MODEL_KEY,
} from "./config-model";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage, Bootloader } from "~/model/system";

jest.mock("~/hooks/model/system/storage", () => ({
  useSystem: jest.fn(),
}));

jest.mock("~/hooks/model/system/bootloader", () => ({
  useSystem: jest.fn(),
}));

jest.mock("~/api", () => ({
  getStorageModel: jest.fn(),
  putStorageModel: jest.fn(),
  solveStorageModel: jest.fn(),
}));

import { useSystem } from "~/hooks/model/system/storage";
import { useSystem as useBootloaderSystem } from "~/hooks/model/system/bootloader";
import { putStorageModel, solveStorageModel } from "~/api";

const mockUseSystem = useSystem as jest.MockedFunction<typeof useSystem>;
const mockUseBootloaderSystem = useBootloaderSystem as jest.MockedFunction<
  typeof useBootloaderSystem
>;
const mockPutStorageModel = putStorageModel as jest.MockedFunction<typeof putStorageModel>;
const mockSolveStorageModel = solveStorageModel as jest.MockedFunction<typeof solveStorageModel>;

describe("config-model hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockUseSystem.mockReturnValue(null);
    mockUseBootloaderSystem.mockReturnValue(null);
    mockPutStorageModel.mockClear();
    mockSolveStorageModel.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useConfigModel", () => {
    it("returns the storage config model", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
        drives: [{ name: "/dev/sda" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useConfigModel(), { wrapper });

      expect(result.current).toEqual(config);
    });

    it("returns null when no config is available", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => useConfigModel(), { wrapper });

      expect(result.current).toBeNull();
    });
  });

  describe("useIsGrub2WithTpm", () => {
    it("returns true when bootloader is grub2 and encryption has tpm enabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
        encryption: { password: "secret", tpm: true },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsGrub2WithTpm(), { wrapper });

      expect(result.current).toBe(true);
    });

    it("returns false when bootloader is grub2 but tpm is disabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
        encryption: { password: "secret", tpm: false },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsGrub2WithTpm(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when bootloader is grub2-bls with tpm enabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2-bls" },
        encryption: { password: "secret", tpm: true },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsGrub2WithTpm(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when bootloader is systemd-boot with tpm enabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "systemd-boot" },
        encryption: { password: "secret", tpm: true },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsGrub2WithTpm(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when config is null", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => useIsGrub2WithTpm(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when encryption is not configured", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsGrub2WithTpm(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when bootloader is not configured", () => {
      const config: ConfigModel.Config = {
        encryption: { password: "secret", tpm: true },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsGrub2WithTpm(), { wrapper });

      expect(result.current).toBe(false);
    });
  });

  describe("useIsTpmAvailable", () => {
    it("returns true when system and bootloader support TPM", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [
          { type: "grub2", encryptionAuth: ["password", "tpm"] },
          { type: "systemd-boot", encryptionAuth: ["password", "tpm"] },
        ],
      };

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      mockUseBootloaderSystem.mockReturnValue(bootloaderSystem);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

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

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      mockUseBootloaderSystem.mockReturnValue(bootloaderSystem);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when system is null", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      mockUseBootloaderSystem.mockReturnValue(null);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when bootloader system is null", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      mockUseBootloaderSystem.mockReturnValue(null);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when config is null", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      mockUseBootloaderSystem.mockReturnValue(bootloaderSystem);
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when bootloader type is not configured", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      const config: ConfigModel.Config = {
        boot: { configure: true },
      };

      mockUseBootloaderSystem.mockReturnValue(bootloaderSystem);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("returns false when boot is not configured", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      const config: ConfigModel.Config = {};

      mockUseBootloaderSystem.mockReturnValue(bootloaderSystem);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

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

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "systemd-boot" },
      };

      mockUseBootloaderSystem.mockReturnValue(bootloaderSystem);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(true);
    });

    it("returns false when bootloader type is not in available bootloaders", () => {
      const bootloaderSystem: Bootloader.System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "systemd-boot" },
      };

      mockUseBootloaderSystem.mockReturnValue(bootloaderSystem);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

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

      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2-bls" },
      };

      mockUseBootloaderSystem.mockReturnValue(bootloaderSystem);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useIsTpmAvailable(), { wrapper });

      expect(result.current).toBe(true);
    });
  });

  describe("useMissingMountPaths", () => {
    it("returns mount paths required by product but not configured", () => {
      const system: Storage.System = {
        productMountPoints: ["/", "/home", "/var"],
      };

      const config: ConfigModel.Config = {
        drives: [
          {
            name: "/dev/sda",
            partitions: [{ mountPath: "/" }, { mountPath: "/home" }],
          },
        ],
      };

      mockUseSystem.mockReturnValue(system);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useMissingMountPaths(), { wrapper });

      expect(result.current).toEqual(["/var"]);
    });

    it("returns empty array when all required mount paths are configured", () => {
      const system: Storage.System = {
        productMountPoints: ["/", "/home"],
      };

      const config: ConfigModel.Config = {
        drives: [
          {
            name: "/dev/sda",
            partitions: [{ mountPath: "/" }, { mountPath: "/home" }],
          },
        ],
      };

      mockUseSystem.mockReturnValue(system);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useMissingMountPaths(), { wrapper });

      expect(result.current).toEqual([]);
    });

    it("returns all product mount points when no config exists", () => {
      const system: Storage.System = {
        productMountPoints: ["/", "/home"],
      };

      mockUseSystem.mockReturnValue(system);
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => useMissingMountPaths(), { wrapper });

      expect(result.current).toEqual(["/", "/home"]);
    });

    it("returns empty array when system has no product mount points", () => {
      const system: Storage.System = {};

      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
      };

      mockUseSystem.mockReturnValue(system);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useMissingMountPaths(), { wrapper });

      expect(result.current).toEqual([]);
    });

    it("returns empty array when system is null", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
      };

      mockUseSystem.mockReturnValue(null);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useMissingMountPaths(), { wrapper });

      expect(result.current).toEqual([]);
    });
  });

  describe("useDevice", () => {
    const config: ConfigModel.Config = {
      drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
      mdRaids: [{ name: "/dev/md0" }],
      volumeGroups: [{ name: "vg0", vgName: "vg0", targetDevices: [] }],
    };

    it("returns device from drives collection", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDevice("drives", 0), { wrapper });

      expect(result.current?.name).toBe("/dev/sda");
    });

    it("returns device from mdRaids collection", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDevice("mdRaids", 0), { wrapper });

      expect(result.current?.name).toBe("/dev/md0");
    });

    it("returns device from volumeGroups collection", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDevice("volumeGroups", 0), { wrapper });

      expect(result.current?.name).toBe("vg0");
    });

    it("returns null when index is out of bounds", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDevice("drives", 10), { wrapper });

      expect(result.current).toBeNull();
    });

    it("returns null when config is null", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => useDevice("drives", 0), { wrapper });

      expect(result.current).toBeNull();
    });
  });

  describe("useSolvedConfigModel", () => {
    it("solves the config model", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
      };

      const solvedConfig: ConfigModel.Config = {
        drives: [{ name: "/dev/sda", partitions: [{ mountPath: "/" }] }],
      };

      queryClient.setQueryData(["solvedStorageModel", JSON.stringify(config)], solvedConfig);

      const { result } = renderHook(() => useSolvedConfigModel(config), { wrapper });

      expect(result.current).toEqual(solvedConfig);
    });

    it("returns null when config is undefined", () => {
      queryClient.setQueryData(["solvedStorageModel", JSON.stringify(undefined)], null);

      const { result } = renderHook(() => useSolvedConfigModel(), { wrapper });

      expect(result.current).toBeNull();
    });
  });

  describe("usePartitionable", () => {
    it("returns partitionable device from drives", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda", partitions: [] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => usePartitionable("drives", 0), { wrapper });

      expect(result.current?.name).toBe("/dev/sda");
    });

    it("returns partitionable device from mdRaids", () => {
      const config: ConfigModel.Config = {
        mdRaids: [{ name: "/dev/md0", partitions: [] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => usePartitionable("mdRaids", 0), { wrapper });

      expect(result.current?.name).toBe("/dev/md0");
    });

    it("returns null when config is null", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => usePartitionable("drives", 0), { wrapper });

      expect(result.current).toBeNull();
    });
  });

  describe("useDrive", () => {
    it("returns drive at index", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDrive(1), { wrapper });

      expect(result.current?.name).toBe("/dev/sdb");
    });

    it("returns null when config is null", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => useDrive(0), { wrapper });

      expect(result.current).toBeNull();
    });
  });

  describe("useMdRaid", () => {
    it("returns mdRaid at index", () => {
      const config: ConfigModel.Config = {
        mdRaids: [{ name: "/dev/md0" }, { name: "/dev/md1" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useMdRaid(1), { wrapper });

      expect(result.current?.name).toBe("/dev/md1");
    });

    it("returns null when config is null", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => useMdRaid(0), { wrapper });

      expect(result.current).toBeNull();
    });
  });

  describe("useVolumeGroup", () => {
    it("returns volume group at index", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [
          { name: "vg0", vgName: "vg0", targetDevices: [] },
          { name: "vg1", vgName: "vg1", targetDevices: [] },
        ],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useVolumeGroup(1), { wrapper });

      expect(result.current?.name).toBe("vg1");
    });

    it("returns null when config is null", () => {
      queryClient.setQueryData([STORAGE_MODEL_KEY], null);

      const { result } = renderHook(() => useVolumeGroup(0), { wrapper });

      expect(result.current).toBeNull();
    });
  });

  describe("useSetBootDevice", () => {
    it("calls putStorageModel with updated boot device", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true },
        drives: [{ name: "/dev/sda" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useSetBootDevice(), { wrapper });

      result.current("/dev/sda");

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useSetDefaultBootDevice", () => {
    it("calls putStorageModel with default boot device", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useSetDefaultBootDevice(), { wrapper });

      result.current();

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useDisableBoot", () => {
    it("calls putStorageModel with boot disabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDisableBoot(), { wrapper });

      result.current();

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useSetEncryption", () => {
    it("calls putStorageModel with encryption settings", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useSetEncryption(), { wrapper });

      result.current({ password: "secret", tpm: false });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });

    it("calls putStorageModel to clear encryption", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
        encryption: { password: "secret", tpm: false },
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useSetEncryption(), { wrapper });

      result.current(undefined);

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useAddDrive", () => {
    it("calls putStorageModel to add drive", () => {
      const config: ConfigModel.Config = {
        drives: [],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useAddDrive(), { wrapper });

      result.current({ name: "/dev/sda" });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useDeleteDrive", () => {
    it("calls putStorageModel to delete drive", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDeleteDrive(), { wrapper });

      result.current(0);

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useAddMdRaid", () => {
    it("calls putStorageModel to add mdRaid", () => {
      const config: ConfigModel.Config = {
        mdRaids: [],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useAddMdRaid(), { wrapper });

      result.current({ name: "/dev/md0" });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useDeleteMdRaid", () => {
    it("calls putStorageModel to delete mdRaid", () => {
      const config: ConfigModel.Config = {
        mdRaids: [{ name: "/dev/md0" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDeleteMdRaid(), { wrapper });

      result.current(0);

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useConvertPartitionableToVolumeGroup", () => {
    it("calls putStorageModel to convert partitionable to volume group", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useConvertPartitionableToVolumeGroup(), { wrapper });

      result.current("/dev/sda");

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useAddVolumeGroup", () => {
    it("calls putStorageModel to add volume group", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useAddVolumeGroup(), { wrapper });

      result.current({ vgName: "vg0", targetDevices: [] }, false);

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useEditVolumeGroup", () => {
    it("calls putStorageModel to edit volume group", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [{ name: "vg0", vgName: "vg0", targetDevices: [] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useEditVolumeGroup(), { wrapper });

      result.current("vg0", { vgName: "vg0", targetDevices: ["/dev/sda"] });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useDeleteVolumeGroup", () => {
    it("calls putStorageModel to delete volume group", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [{ name: "vg0", vgName: "vg0", targetDevices: [] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDeleteVolumeGroup(), { wrapper });

      result.current("vg0", false);

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useAddLogicalVolume", () => {
    it("calls putStorageModel to add logical volume", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [{ name: "vg0", vgName: "vg0", targetDevices: [], logicalVolumes: [] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useAddLogicalVolume(), { wrapper });

      result.current(0, { mountPath: "/var" });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useEditLogicalVolume", () => {
    it("calls putStorageModel to edit logical volume", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [
          {
            name: "vg0",
            vgName: "vg0",
            targetDevices: [],
            logicalVolumes: [{ mountPath: "/var" }],
          },
        ],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useEditLogicalVolume(), { wrapper });

      result.current(0, "/var", { mountPath: "/var" });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useDeleteLogicalVolume", () => {
    it("calls putStorageModel to delete logical volume", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [
          {
            name: "vg0",
            vgName: "vg0",
            targetDevices: [],
            logicalVolumes: [{ mountPath: "/var" }],
          },
        ],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDeleteLogicalVolume(), { wrapper });

      result.current("vg0", "/var");

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useAddPartition", () => {
    it("calls putStorageModel to add partition", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda", partitions: [] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useAddPartition(), { wrapper });

      result.current("drives", 0, { mountPath: "/" });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useEditPartition", () => {
    it("calls putStorageModel to edit partition", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda", partitions: [{ mountPath: "/" }] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useEditPartition(), { wrapper });

      result.current("drives", 0, "/", { mountPath: "/" });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useDeletePartition", () => {
    it("calls putStorageModel to delete partition", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda", partitions: [{ mountPath: "/" }] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useDeletePartition(), { wrapper });

      result.current("drives", 0, "/");

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useSetFilesystem", () => {
    it("calls putStorageModel to set filesystem", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda", partitions: [] }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useSetFilesystem(), { wrapper });

      result.current("drives", 0, { mountPath: "/" });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useSetSpacePolicy", () => {
    it("calls putStorageModel to set space policy", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
      };

      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useSetSpacePolicy(), { wrapper });

      result.current("drives", 0, { type: "keep" });

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });

  describe("useConvertDevice", () => {
    it("calls putStorageModel to convert device", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
      };

      const system: Storage.System = {
        devices: [
          { name: "/dev/sda", sid: 1 },
          { name: "/dev/sdb", sid: 2 },
        ],
      };

      mockUseSystem.mockReturnValue(system);
      queryClient.setQueryData([STORAGE_MODEL_KEY], config);

      const { result } = renderHook(() => useConvertDevice(), { wrapper });

      result.current("/dev/sda", "/dev/sdb");

      expect(mockPutStorageModel).toHaveBeenCalled();
    });
  });
});
