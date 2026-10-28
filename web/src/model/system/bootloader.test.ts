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

import bootloaderSystem from "./bootloader";
import type { System } from "./bootloader";

describe("bootloaderSystem", () => {
  describe("isTpmAvailable", () => {
    it("returns true when bootloader exists and supports TPM", () => {
      const system: System = {
        availableBootloaders: [
          { type: "grub2", encryptionAuth: ["password", "tpm"] },
          { type: "grub2-bls", encryptionAuth: ["password", "tpm"] },
        ],
      };

      expect(bootloaderSystem.isTpmAvailable(system, "grub2")).toBe(true);
      expect(bootloaderSystem.isTpmAvailable(system, "grub2-bls")).toBe(true);
    });

    it("returns false when bootloader exists but does not support TPM", () => {
      const system: System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password"] }],
      };

      expect(bootloaderSystem.isTpmAvailable(system, "grub2")).toBe(false);
    });

    it("returns false when bootloader exists with empty encryptionAuth", () => {
      const system: System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: [] }],
      };

      expect(bootloaderSystem.isTpmAvailable(system, "grub2")).toBe(false);
    });

    it("returns false when bootloader type does not exist", () => {
      const system: System = {
        availableBootloaders: [{ type: "grub2", encryptionAuth: ["password", "tpm"] }],
      };

      expect(bootloaderSystem.isTpmAvailable(system, "systemd-boot")).toBe(false);
    });

    it("returns false when availableBootloaders is empty", () => {
      const system: System = {
        availableBootloaders: [],
      };

      expect(bootloaderSystem.isTpmAvailable(system, "grub2")).toBe(false);
    });
  });

  describe("isBls", () => {
    it("returns true for grub2-bls", () => {
      expect(bootloaderSystem.isBls("grub2-bls")).toBe(true);
    });

    it("returns true for systemd-boot", () => {
      expect(bootloaderSystem.isBls("systemd-boot")).toBe(true);
    });

    it("returns false for grub2", () => {
      expect(bootloaderSystem.isBls("grub2")).toBe(false);
    });
  });
});
