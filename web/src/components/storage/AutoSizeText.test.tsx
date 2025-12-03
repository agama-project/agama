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

import React from "react";
import { screen } from "@testing-library/react";

import AutoSizeText from "~/components/storage/AutoSizeText";
import { installerRender as renderWithProviders } from "~/test-utils";
import type { AutoSizeTextProps } from "~/components/storage/AutoSizeText";
import type { Volume } from "~/api/system/storage";
import type { model } from "~/api/storage";
import { getSystem } from "~/api";

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  getSystem: jest.fn(),
}));

const mockedGetSystem = getSystem as jest.Mock;

const GiB = 1024 * 1024 * 1024;
const MiB = 1024 * 1024;

// A minimal mock for the Volume type.
const MOCK_VOLUME: Volume = {
  autoSize: false,
  mountPath: null,
  outline: {
    adjustByRam: false,
    snapshotsAffectSizes: false,
    sizeRelevantVolumes: [],
    required: false,
    supportAutoSize: false,
  },
  minSize: 0,
};

describe("AutoSizeText", () => {
  beforeEach(() => {
    mockedGetSystem.mockResolvedValue({
      l10n: {
        locale: "en_US.UTF-8",
        keymap: "us",
        timezone: "Europe/Berlin",
      },
    });
  });
  const renderHelper = (props: AutoSizeTextProps) => {
    return renderWithProviders(<AutoSizeText {...props} />, { withL10n: true });
  };

  describe("for fallback volumes", () => {
    const volume: Volume = { ...MOCK_VOLUME, mountPath: null };
    const deviceType = "partition";

    it("displays a fixed size message", async () => {
      const size: model.Size = { min: 1 * GiB, max: 1 * GiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(`A generic size of 1 GiB will be used for the new partition`),
      ).toBeInTheDocument();
    });

    it("displays a size range message", async () => {
      const size: model.Size = { min: 1 * GiB, max: 2 * GiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `A generic size range between 1 GiB and 2 GiB will be used for the new partition`,
        ),
      ).toBeInTheDocument();
    });

    it("displays a minimum size message", async () => {
      const size: model.Size = { min: 1 * GiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `A generic minimum size of 1 GiB will be used for the new partition`,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("for fixed size volumes", () => {
    const volume: Volume = {
      ...MOCK_VOLUME,
      mountPath: "/home",
      autoSize: false,
    };
    const deviceType = "logicalVolume";

    it("displays a fixed size message", async () => {
      const size: model.Size = { min: 20 * GiB, max: 20 * GiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(`A logical volume of 20 GiB will be created for /home if possible`),
      ).toBeInTheDocument();
    });

    it("displays a size range message", async () => {
      const size: model.Size = { min: 20 * GiB, max: 30 * GiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `A logical volume with a size between 20 GiB and 30 GiB will be created for /home if possible`,
        ),
      ).toBeInTheDocument();
    });

    it("displays a minimum size message", async () => {
      const size: model.Size = { min: 20 * GiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `A logical volume of at least 20 GiB will be created for /home if possible`,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("for RAM-based volumes", () => {
    const volume: Volume = {
      ...MOCK_VOLUME,
      mountPath: "/boot/efi",
      autoSize: true,
    };
    const deviceType = "partition";

    it("displays a fixed size message", async () => {
      const size: model.Size = { min: 512 * MiB, max: 512 * MiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `Based on the amount of RAM in the system, a partition of 512 MiB will be planned for /boot/efi`,
        ),
      ).toBeInTheDocument();
    });

    it("displays a size range message", async () => {
      const size: model.Size = { min: 512 * MiB, max: 1 * GiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `Based on the amount of RAM in the system, a partition with a size between 512 MiB and 1 GiB will be planned for /boot/efi`,
        ),
      ).toBeInTheDocument();
    });

    it("displays a minimum size message", async () => {
      const size: model.Size = { min: 512 * MiB, default: false };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `Based on the amount of RAM in the system, a partition of at least 512 MiB will be planned for /boot/efi`,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("for dynamic size volumes", () => {
    const size: model.Size = { min: 10 * GiB, max: 20 * GiB, default: false };
    const deviceType = "partition";
    const baseVolume: Volume = {
      ...MOCK_VOLUME,
      mountPath: "/",
      autoSize: true,
    };

    const expectLimitsText = async () => {
      expect(
        await screen.findByText(
          `The current configuration will result in an attempt to create a partition with a size between 10 GiB and 20 GiB.`,
        ),
      ).toBeInTheDocument();
    };

    it("displays intro for RAM and snapshots", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: { ...baseVolume.outline, snapshotsAffectSizes: true, adjustByRam: true },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `The size for / will be dynamically adjusted based on the amount of RAM in the system and the usage of Btrfs snapshots.`,
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for RAM, snapshots and one other path", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: {
          ...baseVolume.outline,
          snapshotsAffectSizes: true,
          adjustByRam: true,
          sizeRelevantVolumes: ["/home"],
        },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `The size for / will be dynamically adjusted based on the amount of RAM in the system, the usage of Btrfs snapshots and the presence of a separate file system for /home.`,
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for RAM, snapshots and multiple other paths", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: {
          ...baseVolume.outline,
          snapshotsAffectSizes: true,
          adjustByRam: true,
          sizeRelevantVolumes: ["/home", "/var"],
        },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `The size for / will be dynamically adjusted based on the amount of RAM in the system, the usage of Btrfs snapshots and the presence of separate file systems for /home and /var.`,
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for RAM and one other path", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: { ...baseVolume.outline, adjustByRam: true, sizeRelevantVolumes: ["/home"] },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `The size for / will be dynamically adjusted based on the amount of RAM in the system and the presence of a separate file system for /home.`,
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for RAM and multiple other paths", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: {
          ...baseVolume.outline,
          adjustByRam: true,
          sizeRelevantVolumes: ["/home", "/var"],
        },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `The size for / will be dynamically adjusted based on the amount of RAM in the system and the presence of separate file systems for /home and /var.`,
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for snapshots and one other path", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: {
          ...baseVolume.outline,
          snapshotsAffectSizes: true,
          sizeRelevantVolumes: ["/home"],
        },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `The size for / will be dynamically adjusted based on the usage of Btrfs snapshots and the presence of a separate file system for /home.`,
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for snapshots and multiple other paths", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: {
          ...baseVolume.outline,
          snapshotsAffectSizes: true,
          sizeRelevantVolumes: ["/home", "/var"],
        },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          `The size for / will be dynamically adjusted based on the usage of Btrfs snapshots and the presence of separate file systems for /home and /var.`,
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for just snapshots", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: { ...baseVolume.outline, snapshotsAffectSizes: true },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          "The size for / will be dynamically adjusted based on the usage of Btrfs snapshots.",
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for just one other path", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: { ...baseVolume.outline, sizeRelevantVolumes: ["/home"] },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          "The size for / will be dynamically adjusted based on the presence of a separate file system for /home.",
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays intro for just multiple other paths", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: { ...baseVolume.outline, sizeRelevantVolumes: ["/home", "/var"] },
      };
      renderHelper({ volume, size, deviceType });

      expect(
        await screen.findByText(
          "The size for / will be dynamically adjusted based on the presence of separate file systems for /home and /var.",
        ),
      ).toBeInTheDocument();
      await expectLimitsText();
    });

    it("displays limits with a fixed size", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: { ...baseVolume.outline, snapshotsAffectSizes: true },
      };
      const fixedSize: model.Size = { min: 10 * GiB, max: 10 * GiB, default: false };
      renderHelper({ volume, size: fixedSize, deviceType });

      expect(
        await screen.findByText(
          "The current configuration will result in an attempt to create a partition of 10 GiB.",
        ),
      ).toBeInTheDocument();
    });

    it("displays limits with a minimum size", async () => {
      const volume: Volume = {
        ...baseVolume,
        outline: { ...baseVolume.outline, snapshotsAffectSizes: true },
      };
      const minSize: model.Size = { min: 10 * GiB, default: false };
      renderHelper({ volume, size: minSize, deviceType });

      expect(
        await screen.findByText(
          "The current configuration will result in an attempt to create a partition of at least 10 GiB.",
        ),
      ).toBeInTheDocument();
    });
  });
});
