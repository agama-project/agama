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

import zfcpModel from "~/model/config/zfcp";
import type { Config, Device } from "~/model/config/zfcp";

type ConfigStructurePreservationTest = Config & {
  futureProperty: "must_be_preserved";
};

const mockDevice1: Device = {
  channel: "0.0.5000",
  wwpn: "0x500507630510c1e3",
  lun: "0x4010404900000000",
};
const mockDevice2: Device = {
  channel: "0.0.5000",
  wwpn: "0x500507630510c1e3",
  lun: "0x4010404900000001",
};
const mockDevice3: Device = {
  channel: "0.0.6000",
  wwpn: "0x500507630510c1e4",
  lun: "0x4010404900000000",
};
const mockInitialConfig: Config = { devices: [mockDevice1] };

describe("model/config/zfcp", () => {
  describe("#addDevice", () => {
    it("preserves existing config properties while adding the device", () => {
      const initialConfig = {
        ...mockInitialConfig,
        futureProperty: "must_be_preserved",
      } as ConfigStructurePreservationTest;
      const newConfig = zfcpModel.addDevice(
        initialConfig,
        mockDevice2,
      ) as ConfigStructurePreservationTest;
      expect(newConfig).not.toBe(initialConfig);
      expect(newConfig.futureProperty).toBe("must_be_preserved");
    });

    describe("when the device does not yet exist in the config", () => {
      it("appends the new device to the existing list", () => {
        const newConfig = zfcpModel.addDevice(mockInitialConfig, mockDevice2);
        expect(newConfig).not.toBe(mockInitialConfig);
        expect(newConfig.devices).toContain(mockDevice1);
        expect(newConfig.devices).toContain(mockDevice2);
      });
    });

    describe("when the device already exists in the config", () => {
      it("replaces the existing device instead of appending", () => {
        const updatedDevice: Device = { ...mockDevice1 };
        const newConfig = zfcpModel.addDevice(mockInitialConfig, updatedDevice);
        expect(newConfig.devices).toHaveLength(1);
        expect(newConfig.devices[0]).toBe(updatedDevice);
        expect(newConfig.devices[0]).not.toBe(mockDevice1);
      });
    });

    describe("when config devices are empty or undefined", () => {
      it("returns a config containing only the new device", () => {
        expect(zfcpModel.addDevice({}, mockDevice1)).toEqual({ devices: [mockDevice1] });
        expect(zfcpModel.addDevice({ devices: [] }, mockDevice1)).toEqual({
          devices: [mockDevice1],
        });
        expect(zfcpModel.addDevice({ devices: undefined }, mockDevice1)).toEqual({
          devices: [mockDevice1],
        });
      });
    });
  });

  describe("#addDevices", () => {
    it("preserves existing config properties while adding devices", () => {
      const initialConfig = {
        ...mockInitialConfig,
        futureProperty: "must_be_preserved",
      } as ConfigStructurePreservationTest;
      const newConfig = zfcpModel.addDevices(initialConfig, [
        mockDevice2,
      ]) as ConfigStructurePreservationTest;
      expect(newConfig).not.toBe(initialConfig);
      expect(newConfig.futureProperty).toBe("must_be_preserved");
    });

    it("adds multiple new devices to the config", () => {
      const newConfig = zfcpModel.addDevices(mockInitialConfig, [mockDevice2, mockDevice3]);
      expect(newConfig.devices).toContain(mockDevice1);
      expect(newConfig.devices).toContain(mockDevice2);
      expect(newConfig.devices).toContain(mockDevice3);
    });

    it("replaces existing devices that match channel, wwpn, and lun", () => {
      const updatedDevice1: Device = { ...mockDevice1 };
      const newConfig = zfcpModel.addDevices(mockInitialConfig, [updatedDevice1, mockDevice2]);
      expect(newConfig.devices).toHaveLength(2);
      expect(newConfig.devices[0]).toBe(updatedDevice1);
      expect(newConfig.devices[0]).not.toBe(mockDevice1);
    });

    it("returns a copy of the config when given an empty device list", () => {
      const newConfig = zfcpModel.addDevices(mockInitialConfig, []);
      expect(newConfig).not.toBe(mockInitialConfig);
      expect(newConfig).toEqual(mockInitialConfig);
    });

    it("creates a default config when given null", () => {
      const newConfig = zfcpModel.addDevices(null, [mockDevice1]);
      expect(newConfig.devices).toContain(mockDevice1);
    });
  });

  describe("#addControllers", () => {
    it("preserves existing config properties while adding controllers", () => {
      const initialConfig = {
        controllers: ["0.0.5000"],
        futureProperty: "must_be_preserved",
      } as ConfigStructurePreservationTest;
      const newConfig = zfcpModel.addControllers(initialConfig, [
        "0.0.6000",
      ]) as ConfigStructurePreservationTest;
      expect(newConfig).not.toBe(initialConfig);
      expect(newConfig.futureProperty).toBe("must_be_preserved");
    });

    it("adds new controllers to an existing list", () => {
      const config: Config = { controllers: ["0.0.5000"] };
      const newConfig = zfcpModel.addControllers(config, ["0.0.6000"]);
      expect(newConfig.controllers).toContain("0.0.5000");
      expect(newConfig.controllers).toContain("0.0.6000");
    });

    it("deduplicates controllers that already exist", () => {
      const config: Config = { controllers: ["0.0.5000"] };
      const newConfig = zfcpModel.addControllers(config, ["0.0.5000", "0.0.6000"]);
      expect(newConfig.controllers).toHaveLength(2);
      expect(newConfig.controllers).toEqual(["0.0.5000", "0.0.6000"]);
    });

    it("creates a default config when given null", () => {
      const newConfig = zfcpModel.addControllers(null, ["0.0.5000"]);
      expect(newConfig.controllers).toContain("0.0.5000");
    });

    it("handles an empty controllers list without changing existing controllers", () => {
      const config: Config = { controllers: ["0.0.5000"] };
      const newConfig = zfcpModel.addControllers(config, []);
      expect(newConfig.controllers).toEqual(["0.0.5000"]);
    });
  });
});
