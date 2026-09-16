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
 * The separators and the conjunction between the names belong to the language,
 * so a line reading this writes one sentence with a single hole in it and fills
 * that hole with `formatList`. A sentence with a hole per name has to agree
 * with this number on how many there are, and nothing makes them agree: raise
 * it past what the sentence has room for and the rest of the names are dropped
 * without a mark.
 *
 * `ConfigurationTitle` is the one place still written that way, because its
 * names are links rather than text and the list has to be punctuated around
 * them. It is safe, since it asks for one name or two by number and counts
 * anything else, but raising this past two leaves it counting while the rows
 * name. See `storage-main-page-naming-decision` in the notes.
 */
const NAMES_PER_LINE = 2;

export { NAMES_PER_LINE };
