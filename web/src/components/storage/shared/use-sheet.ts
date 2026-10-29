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
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { SHEET } from "~/components/storage/ui-state-params";
import type { To } from "react-router";
import type { ConfigModel } from "~/model/storage/config-model";

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
 * What an entry of the configuration is called in the address: a disk or a
 * RAID by its device name without the leading `/dev/` (`vdb`, `md0`), a
 * volume group by its name (`system`). Nothing where the configuration has no
 * such entry.
 */
function nameOf(config: ConfigModel.Config | null, entry: SheetEntry): string | undefined {
  const item = config?.[entry.collection]?.[entry.index];
  if (!item) return undefined;

  return "vgName" in item ? item.vgName : item.name.replace(/^\/dev\//, "");
}

/**
 * The address form of an entry: "drives.vdb", "volumeGroups.system".
 *
 * Readable and editable by hand, which is the point of keeping it in the
 * address at all. An entry is named by where it is written and by its name,
 * not by its position there: a position names whatever entry is at that place
 * now, so a change that adds or removes entries would leave the address
 * naming another one, and the panel showing it without the reader asking.
 * Names are unique within each collection: a device is in the configuration
 * once, and a volume group name is refused when it is taken.
 *
 * A full stop rather than a colon between the two, although a colon is legal in
 * a query value: the encoder the browser gives us escapes it to `%3A`, and an
 * address nobody can read by eye is not one anybody will edit by hand.
 */
function toParam(config: ConfigModel.Config | null, entry: SheetEntry): string | undefined {
  const name = nameOf(config, entry);
  return name && `${entry.collection}.${name}`;
}

/**
 * The entry an address names, or nothing where it names none.
 *
 * Split at the first full stop only, since device names can hold full stops
 * of their own.
 *
 * Anything the page cannot make sense of reads as a shut sheet rather than as
 * an error: the address is editable by hand, and a typo in it should leave the
 * reader on the page rather than on a broken one. So does an address naming an
 * entry the configuration no longer has, and one written in an older form,
 * by position (`drives.0`) or for the whole result (`result`).
 */
function fromParam(config: ConfigModel.Config | null, value: string | null): SheetEntry | null {
  if (!value) return null;

  const dot = value.indexOf(".");
  if (dot < 0) return null;

  const collection = value.slice(0, dot) as SheetCollection;
  const name = value.slice(dot + 1);
  if (!COLLECTIONS.includes(collection)) return null;

  const entries = config?.[collection] || [];
  const index = entries.findIndex((_, i) => nameOf(config, { collection, index: i }) === name);

  return index < 0 ? null : { collection, index };
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
  const config = useConfigModel();
  const [params, setParams] = useSearchParams();
  const subject = fromParam(config, params.get(SHEET));

  const addressOf = (subject: SheetEntry): To => {
    const next = new URLSearchParams(params);
    const param = toParam(config, subject);
    if (param) next.set(SHEET, param);
    return { search: `?${next}` };
  };

  const openSheet = (subject: SheetEntry) =>
    setParams((next) => {
      const param = toParam(config, subject);
      if (param) next.set(SHEET, param);
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
