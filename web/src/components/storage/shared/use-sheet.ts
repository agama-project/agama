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

import { useSearchParams } from "react-router";
import { SEARCH_PARAM_UPDATE } from "~/hooks/use-search-param-state";
import { SHEET } from "~/components/storage/ui-state-params";
import type { To } from "react-router";

/**
 * The identity of the one sheet the storage page opens, so that a control can
 * point at what it opens.
 */
const SHEET_ID = "storage-sheet";

/** Where an entry of the configuration is written, which is how it is addressed. */
type SheetCollection = "drives" | "mdRaids" | "volumeGroups";

/** One entry of the configuration, as the address names it. */
type SheetEntry = { collection: SheetCollection; index: number };

const COLLECTIONS: SheetCollection[] = ["drives", "mdRaids", "volumeGroups"];

/**
 * The address form of an entry: "drives.0".
 *
 * Readable and editable by hand, which is the point of keeping it in the
 * address at all. An entry is named by where it is written and its position,
 * which is how the storage pages already address one.
 *
 * A full stop rather than a colon between the two, although a colon is legal in
 * a query value: the encoder the browser gives us escapes it to `%3A`, and an
 * address nobody can read by eye is not one anybody will edit by hand.
 */
function toParam(entry: SheetEntry): string {
  return `${entry.collection}.${entry.index}`;
}

/**
 * The entry an address names, or nothing where it names none.
 *
 * Anything the page cannot make sense of reads as a shut sheet rather than as
 * an error: the address is editable by hand, and a typo in it should leave the
 * reader on the page rather than on a broken one. So does an address written
 * when the sheet could also show the whole result, which it no longer does.
 */
function fromParam(value: string | null): SheetEntry | null {
  if (!value) return null;

  const [collection, position] = value.split(".");
  const index = Number(position);

  if (!COLLECTIONS.includes(collection as SheetCollection)) return null;
  if (!Number.isInteger(index) || index < 0) return null;

  return { collection: collection as SheetCollection, index };
}

/**
 * The open state of the storage page's sheet, which lives in the address.
 *
 * Several places on the page open the same panel, and putting what it shows in
 * the address rather than in a component means they do not have to agree about
 * anything: each is a link to a page in a particular state, the reader can
 * reload or share that address and get it back, and a test can arrive at an
 * open sheet without clicking its way there first.
 *
 * The address is replaced rather than pushed, so the back button steps between
 * pages instead of between individual openings of the same panel.
 */
function useSheet(): {
  /** What the sheet is showing, or nothing where it is shut. */
  subject: SheetEntry | null;
  /** Where a control that opens the sheet on something should point. */
  addressOf: (subject: SheetEntry) => To;
  /**
   * Opens it, for a control that cannot carry an address. A menu item is one:
   * it is a menu item wherever it appears, so it acts rather than links, and
   * the address it writes is the same one a link would have carried.
   */
  openSheet: (subject: SheetEntry) => void;
  /** Shuts it. */
  close: () => void;
} {
  const [params, setParams] = useSearchParams();
  const subject = fromParam(params.get(SHEET));

  const addressOf = (subject: SheetEntry): To => {
    const next = new URLSearchParams(params);
    next.set(SHEET, toParam(subject));
    return { search: `?${next}` };
  };

  const openSheet = (subject: SheetEntry) =>
    setParams((next) => {
      next.set(SHEET, toParam(subject));
      return next;
    }, SEARCH_PARAM_UPDATE);

  const close = () =>
    setParams((next) => {
      next.delete(SHEET);
      return next;
    }, SEARCH_PARAM_UPDATE);

  return { subject, addressOf, openSheet, close };
}

export { useSheet, SHEET_ID };
export type { SheetEntry, SheetCollection };
