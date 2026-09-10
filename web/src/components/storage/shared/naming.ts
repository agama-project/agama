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

/**
 * How many things a line names before it counts them instead.
 *
 * Everywhere the page refers to several things at once it follows one rule:
 * name them while naming is worth more than counting, then give a number. A
 * name is something the reader made or recognizes, and "2 LVM volume groups" is
 * arithmetic.
 *
 * How many a line can afford depends on how much room it has and how much else
 * it is already saying, so this is a starting point rather than a law: two is
 * defensible everywhere, and a line that wants three or one says so where it is
 * written. They are all here so that the set can be looked at together, which is
 * the only way to tell whether one of them is wrong.
 *
 * Past two, a line is interpolating a list whose separators and conjunction
 * belong to the language, which is a different problem. Solve that properly,
 * with `Intl.ListFormat`, rather than by joining strings.
 */
const NAMES_PER_LINE = 2;

export { NAMES_PER_LINE };
