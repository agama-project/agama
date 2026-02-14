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

const mockDASDDevice: Device = {
  channel: "0.0.0160",
  state: "offline",
  format: false,
  diag: true,
};

const mockInitialDASDConfig: Config = {
  devices: [mockDASDDevice],
};

describe("model/storage/dasd", () => {
  describe("#addDevice", () => {
    it("preserves existing config properties while adding the device", () => {
      const deviceToAdd = { channel: "0.0.0150", state: "active" as const };

      const initialConfig = {
        ...mockInitialDASDConfig,
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
        const deviceToAdd = { channel: "0.0.0150", state: "active" as const };

        const newConfig = dasdModel.addDevice(mockInitialDASDConfig, deviceToAdd);
        expect(newConfig).not.toBe(mockInitialDASDConfig);
        expect(newConfig.devices).toContain(mockDASDDevice);
        expect(newConfig.devices).toContain(deviceToAdd);
      });
    });

    describe("when config devices are empty or undefined", () => {
      it("returns a config containing only the new device", () => {
        const deviceToAdd = { channel: "0.0.0150", state: "active" as const };

        expect(dasdModel.addDevice({}, deviceToAdd)).toEqual({
          devices: [deviceToAdd],
        });

        expect(dasdModel.addDevice({ devices: [] }, deviceToAdd)).toEqual({
          devices: [deviceToAdd],
        });

        expect(dasdModel.addDevice({ devices: undefined }, deviceToAdd)).toEqual({
          devices: [deviceToAdd],
        });

        expect(dasdModel.addDevice({ devices: null }, deviceToAdd)).toEqual({
          devices: [deviceToAdd],
        });
      });
    });
  });

  describe("#removeDevice", () => {
    it("preserves existing config properties while removing the device", () => {
      const initialConfig = {
        ...mockInitialDASDConfig,
        futureProperty: "must_be_preserved",
      } as ConfigStructurePreservationTest;

      const newConfig = dasdModel.removeDevice(
        initialConfig,
        mockDASDDevice.channel,
      ) as ConfigStructurePreservationTest;

      expect(newConfig).not.toBe(initialConfig);
      expect(newConfig.futureProperty).toBe("must_be_preserved");
    });

    it("returns a new config with the specified device removed", () => {
      const newConfig = dasdModel.removeDevice(mockInitialDASDConfig, mockDASDDevice.channel);
      expect(newConfig).not.toBe(mockInitialDASDConfig);
      expect(newConfig.devices).not.toContain(mockDASDDevice);
    });
  });
});
