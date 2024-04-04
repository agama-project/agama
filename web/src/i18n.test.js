/*
 * Copyright (c) [2023] SUSE LLC
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

import { _, n_, N_, Nn_ } from "~/i18n";
import agama from "~/agama";

// mock the cockpit gettext functions
jest.mock("~/agama");
const gettextFn = jest.fn();
agama.gettext.mockImplementation(gettextFn);
const ngettextFn = jest.fn();
agama.ngettext.mockImplementation(ngettextFn);

// some testing texts
const text = "text to translate";
const singularText = "singular text to translate";
const pluralText = "plural text to translate";

describe("i18n", () => {
  describe("_", () => {
    it("calls the agama.gettext() implementation", () => {
      _(text);

      expect(gettextFn).toHaveBeenCalledWith(text);
    });
  });

  describe("n_", () => {
    it("calls the agama.ngettext() implementation", () => {
      n_(singularText, pluralText, 1);

      expect(ngettextFn).toHaveBeenCalledWith(singularText, pluralText, 1);
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
