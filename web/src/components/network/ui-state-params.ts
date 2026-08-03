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
 * Each name says what it holds, so an address can be read and edited by hand.
 * The value carried here is composed, though, so it is meant to be read rather
 * than written: a column and a direction. Table filters need nothing here, since
 * `useFilterParams` names each param after the filter itself.
 */

/** Connections table: sorted column and direction, as in `sortBy=type:desc`. */
const SORT = "sortBy";

export { SORT };
