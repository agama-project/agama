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
import { useSearchParamState, SEARCH_PARAM_UPDATE } from "~/hooks/use-search-param-state";
import { SHEET, SHEET_TAB } from "~/components/storage/ui-state-params";
import type { To } from "react-router";

/**
 * The identity of the one sheet the storage page opens, so that a control can
 * point at what it opens.
 */
const SHEET_ID = "storage-sheet";

/** What the sheet is showing. */
type SheetSubject = "result";

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
  subject: SheetSubject | null;
  /** Where a control that opens the sheet on something should point. */
  addressOf: (subject: SheetSubject) => To;
  /** Shuts it. */
  close: () => void;
} {
  const [params, setParams] = useSearchParams();
  const subject = (params.get(SHEET) as SheetSubject) || null;

  const addressOf = (subject: SheetSubject): To => {
    const next = new URLSearchParams(params);
    next.set(SHEET, subject);
    return { search: `?${next}` };
  };

  const close = () =>
    setParams((next) => {
      next.delete(SHEET);
      next.delete(SHEET_TAB);
      return next;
    }, SEARCH_PARAM_UPDATE);

  return { subject, addressOf, close };
}

/**
 * Which half of the open sheet is being read.
 *
 * Held beside what the sheet shows rather than inside whatever draws it, so
 * that a reader comparing two things is not sent back to the first tab between
 * them, and so that an address names the tab as well as the subject.
 */
function useSheetTab(defaultTab: string) {
  return useSearchParamState(SHEET_TAB, defaultTab);
}

export { useSheet, useSheetTab, SHEET_ID };
export type { SheetSubject };
