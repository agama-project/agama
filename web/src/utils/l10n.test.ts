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

import { languageFromLocale, languageToLocale } from "~/utils/l10n";

describe("languageFromLocale", () => {
  it("returns the language tag of the given locale", () => {
    expect(languageFromLocale("en_US.UTF-8")).toEqual("en-US");
    expect(languageFromLocale("pt_BR.UTF-8")).toEqual("pt-BR");
  });

  describe("when the locale carries no encoding", () => {
    it("returns the language tag anyway", () => {
      expect(languageFromLocale("es_ES")).toEqual("es-ES");
    });
  });

  describe("when the locale carries no territory", () => {
    it("returns just the language", () => {
      expect(languageFromLocale("ca.UTF-8")).toEqual("ca");
    });
  });
});

describe("languageToLocale", () => {
  it("returns the UTF-8 locale for the given language tag", () => {
    expect(languageToLocale("en-US")).toEqual("en_US.UTF-8");
    expect(languageToLocale("pt-BR")).toEqual("pt_BR.UTF-8");
  });

  describe("when the territory is not uppercase", () => {
    it("uppercases it", () => {
      expect(languageToLocale("es-es")).toEqual("es_ES.UTF-8");
    });
  });

  describe("when the language tag carries no territory", () => {
    it("returns the language with the encoding", () => {
      expect(languageToLocale("ca")).toEqual("ca.UTF-8");
    });
  });
});
