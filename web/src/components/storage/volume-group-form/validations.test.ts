/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { validate } from "./validations";
import type { FormFields } from "./fields";

const createBaseFields = (): FormFields => ({
  vgName: "system",
  targetDevices: ["/dev/sda"],
  moveMountPoints: true,
});

const NAME_CHARACTERS_ERROR =
  "The name can only contain letters, digits and the characters '+', '_', '.' and '-'.";
const NAME_START_ERROR = "The name cannot begin with a hyphen or be '.' or '..'.";

describe("validations", () => {
  describe("validate", () => {
    it("passes for a valid volume group", () => {
      expect(validate(createBaseFields())).toBeUndefined();
    });

    describe("volume group name validation", () => {
      it("returns error when the name is empty", () => {
        const result = validate({ ...createBaseFields(), vgName: "" });
        expect(result?.fields?.vgName).toBe("Enter a name for the volume group.");
      });

      it("returns error when the name is only whitespace", () => {
        const result = validate({ ...createBaseFields(), vgName: "   " });
        expect(result?.fields?.vgName).toBe("Enter a name for the volume group.");
      });

      it.each(["$this", "my vg", "vg/one", "vg:one", "vg*", "ünï", "名前", "a\tb"])(
        "returns error when the name has characters LVM does not accept: %j",
        (vgName) => {
          const result = validate({ ...createBaseFields(), vgName });
          expect(result?.fields?.vgName).toBe(NAME_CHARACTERS_ERROR);
        },
      );

      it.each(["-vg", "-", ".", ".."])("returns error for the name %j", (vgName) => {
        const result = validate({ ...createBaseFields(), vgName });
        expect(result?.fields?.vgName).toBe(NAME_START_ERROR);
      });

      it.each(["system", "My_vg-1.+x", "a", "vg-", "_vg", "+vg", ".hidden", "vg.."])(
        "accepts the name %j",
        (vgName) => {
          expect(validate({ ...createBaseFields(), vgName })).toBeUndefined();
        },
      );

      it("returns error when the name is already used by another volume group", () => {
        const result = validate({ ...createBaseFields(), vgName: "system" }, ["system", "data"]);
        expect(result?.fields?.vgName).toBe(
          "Volume group 'system' already exists. Enter a different name.",
        );
      });

      it("accepts a name that is not used by another volume group", () => {
        expect(validate({ ...createBaseFields(), vgName: "home" }, ["system"])).toBeUndefined();
      });

      it("reports the invalid characters before the name being already used", () => {
        const result = validate({ ...createBaseFields(), vgName: "my vg" }, ["my vg"]);
        expect(result?.fields?.vgName).toBe(NAME_CHARACTERS_ERROR);
      });
    });

    describe("target devices validation", () => {
      it("returns error when no device is selected", () => {
        const result = validate({ ...createBaseFields(), targetDevices: [] });
        expect(result?.fields?.targetDevices).toBe("Select at least one disk.");
      });

      it("accepts several devices", () => {
        const fields = { ...createBaseFields(), targetDevices: ["/dev/sda", "/dev/md0"] };
        expect(validate(fields)).toBeUndefined();
      });
    });

    it("returns the errors of every invalid field at once", () => {
      const result = validate({ ...createBaseFields(), vgName: "", targetDevices: [] });
      expect(result?.fields).toEqual({
        vgName: "Enter a name for the volume group.",
        targetDevices: "Select at least one disk.",
      });
    });
  });
});
