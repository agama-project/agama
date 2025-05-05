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

import agama from "~/agama";

describe("agama", () => {
  describe("formatList", () => {
    afterEach(() => {
      // restore the default language
      agama.language = "en";
    });

    it("it accepts a locale with underscore", () => {
      agama.language = "zh_CN";
      const list = agama.formatList(["1", "2", "3"], {});
      expect(list).toEqual("1、2和3");
    });

    it("it fallbacks to a simple formatting when the localized function fails", () => {
      agama.language = "invalid:language";
      // disable the console logging in this test, a failure is expected so do
      // not mess the output with a false alarm
      jest.spyOn(console, "warn").mockImplementation();
      const list = agama.formatList(["1", "2", "3"], {});
      expect(list).toEqual("1, 2, 3");
    });
  });
});
