/*
 * Copyright (c) [2024] SUSE LLC
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

import { suggestUsernames } from "./utils";

describe('suggestUsernames', () => {
  test('handles basic single name', () => {
    expect(suggestUsernames('John')).toEqual(expect.arrayContaining(['john']));
  });

  test('handles basic two-part name', () => {
    expect(suggestUsernames('John Doe')).toEqual(expect.arrayContaining(['john', 'jdoe', 'johnd', 'johndoe']));
  });

  test('handles name with middle initial', () => {
    expect(suggestUsernames('John Q. Doe')).toEqual(expect.arrayContaining(['john', 'jqdoe', 'johnqd', 'johnqdoe']));
  });

  test('normalizes accented characters', () => {
    expect(suggestUsernames('José María')).toEqual(expect.arrayContaining(['jose', 'jmaria', 'josem', 'josemaria']));
  });

  test('removes hyphens and apostrophes', () => {
    expect(suggestUsernames("Jean-Luc O'Neill")).toEqual(expect.arrayContaining(['jeanluc', 'joneill', 'jeanluco', 'jeanluconeill']));
  });

  test('removes non-alphanumeric characters', () => {
    expect(suggestUsernames("Anna*#& Maria$%^")).toEqual(expect.arrayContaining(['anna', 'amaria', 'annam', 'annamaria']));
  });

  test('handles long name with multiple parts', () => {
    expect(suggestUsernames("Maria del Carmen Fernandez Vega")).toEqual(expect.arrayContaining(['maria', 'mdelcarmenfernandezvega', 'mariadcfv', 'mdcfvega', 'mariadelcarmenfernandezvega']));
  });

  test('handles empty or invalid input', () => {
    expect(suggestUsernames("")).toEqual(expect.arrayContaining([]));
  });

  test('trims spaces and handles multiple spaces between names', () => {
    expect(suggestUsernames("   John   Doe   ")).toEqual(expect.arrayContaining(['john', 'jdoe', 'johnd', 'johndoe']));
  });
});
