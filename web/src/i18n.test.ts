/*
 * Copyright (c) [2023-2024] SUSE LLC
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

/* eslint-disable agama-i18n/string-literals */

import { _, n_, N_, Nn_ } from "~/i18n";
import agama from "~/agama";

// mock the gettext functions
jest.mock("~/agama", () => ({
  ...jest.requireActual("~/agama"),
  gettext: jest.fn(),
  ngettext: jest.fn(),
}));

// some testing texts
const text = "text to translate";
const singularText = "singular text to translate";
const pluralText = "plural text to translate";

describe("i18n", () => {
  describe("_", () => {
    it("calls the agama.gettext() implementation", () => {
      _(text);

      expect(agama.gettext).toHaveBeenCalledWith(text);
    });
  });

  describe("n_", () => {
    it("calls the agama.ngettext() implementation", () => {
      n_(singularText, pluralText, 1);

      expect(agama.ngettext).toHaveBeenCalledWith(singularText, pluralText, 1);
    });
  });

  describe("N_", () => {
    it("returns the original text and does not translate it", () => {
      const val = N_(text);

      // test the object identity
      expect(Object.is(val, text)).toBe(true);
    });
  });

  describe("Nn_", () => {
    it("returns the singular form for value 1 and does not translate it", () => {
      const val = Nn_(singularText, pluralText, 1);

      // test the object identity
      expect(Object.is(val, singularText)).toBe(true);
    });

    it("returns the plural form for value 42 and does not translate it", () => {
      const val = Nn_(singularText, pluralText, 42);

      // test the object identity
      expect(Object.is(val, pluralText)).toBe(true);
    });
  });
});
