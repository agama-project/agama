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
 * Names the network pages use to keep their UI state in the URL.
 *
 * Gathering them here keeps the vocabulary in one place: the generic hooks in
 * `~/hooks/use-search-param-state` know nothing about network, and the
 * components know only which name to ask for.
 *
 * These names are kept short because they hold structured values a reader is
 * not meant to compose by hand. Table filters work the other way around: they
 * are named after themselves by `useFilterParams`, so an address spells out
 * what it filters by.
 */

/** Connections table: sorted column and direction, as in `s=type:desc`. */
const SORT = "s";

export { SORT };
