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

import dasdModel from "~/model/config/dasd";
import type { Config, Device } from "~/model/config/dasd";

type ConfigStructurePreservationTest = Config & {
  futureProperty: "must_be_preserved";
};

const mockDeviceOffline: Device = { channel: "0.0.0150", state: "offline" as const };
const mockDeviceActive: Device = { channel: "0.0.0160", state: "active" as const };
const mockInitialConfig: Config = { devices: [mockDeviceActive] };

describe("model/config/dasd", () => {
  describe("#addDevice", () => {
    it("preserves existing config properties while adding the device", () => {
      const deviceToAdd = { channel: "0.0.0150", state: "active" as const };

      const initialConfig = {
        ...mockInitialConfig,
        futureProperty: "must_be_preserved",
      } as ConfigStructurePreservationTest;

      const newConfig = dasdModel.addDevice(
        initialConfig,
        deviceToAdd,
      ) as ConfigStructurePreservationTest;

      expect(newConfig).not.toBe(initialConfig);
      expect(newConfig.futureProperty).toBe("must_be_preserved");
    });

    describe("when config already has devices", () => {
      it("appends the new device to the existing list", () => {
        const newConfig = dasdModel.addDevice(mockInitialConfig, mockDeviceOffline);
        expect(newConfig).not.toBe(mockInitialConfig);
        expect(newConfig.devices).toContain(mockDeviceActive);
        expect(newConfig.devices).toContain(mockDeviceOffline);
      });
    });

    describe("when config devices are empty or undefined", () => {
      it("returns a config containing only the new device", () => {
        expect(dasdModel.addDevice({}, mockDeviceOffline)).toEqual({
          devices: [mockDeviceOffline],
        });

        expect(dasdModel.addDevice({ devices: [] }, mockDeviceOffline)).toEqual({
          devices: [mockDeviceOffline],
        });

        expect(dasdModel.addDevice({ devices: undefined }, mockDeviceOffline)).toEqual({
          devices: [mockDeviceOffline],
        });

        expect(dasdModel.addDevice({ devices: null }, mockDeviceOffline)).toEqual({
          devices: [mockDeviceOffline],
        });
      });
    });
  });

  describe("#removeDevice", () => {
    it("preserves existing config properties while removing the device", () => {
      const initialConfig = {
        ...mockInitialConfig,
        futureProperty: "must_be_preserved",
      } as ConfigStructurePreservationTest;

      const newConfig = dasdModel.removeDevice(
        initialConfig,
        mockDeviceActive.channel,
      ) as ConfigStructurePreservationTest;

      expect(newConfig).not.toBe(initialConfig);
      expect(newConfig.futureProperty).toBe("must_be_preserved");
    });

    it("returns a new config with the specified device removed", () => {
      const toRemove = mockInitialConfig.devices[0];
      const newConfig = dasdModel.removeDevice(mockInitialConfig, toRemove.channel);
      expect(newConfig).not.toBe(mockInitialConfig);
      expect(newConfig.devices).not.toContain(toRemove);
    });
  });
});
