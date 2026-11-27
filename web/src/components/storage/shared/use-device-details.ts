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
import { CURRENT_CONTENT, EXPANDED, DEVICE_DETAILS } from "~/components/storage/ui-state-params";
import type { To } from "react-router";
import type { ConfigModel } from "~/model/storage/config-model";

/** The id of the storage page panel, for the `aria-controls` of what opens it. */
const DETAILS_PANEL_ID = "device-details-panel";

/** The configuration collection an entry belongs to. */
type DetailsCollection = "drives" | "mdRaids" | "volumeGroups";

/** An entry of the configuration, by collection and position. */
type DetailsSubject = { collection: DetailsCollection; index: number };

const COLLECTIONS: DetailsCollection[] = ["drives", "mdRaids", "volumeGroups"];

/**
 * The name of an entry in the address: the device name without `/dev/` for a
 * disk or a RAID (`vdb`, `md0`), the name of a volume group (`system`).
 * Undefined when the configuration has no such entry.
 */
function nameOf(config: ConfigModel.Config | null, entry: DetailsSubject): string | undefined {
  const item = config?.[entry.collection]?.[entry.index];
  if (!item) return undefined;

  return "vgName" in item ? item.vgName : item.name.replace(/^\/dev\//, "");
}

/**
 * The address form of an entry, such as "drives.vdb" or "volumeGroups.system".
 *
 * Entries are named by collection and name rather than by position, so adding
 * or removing entries never makes the address point at another one. A full
 * stop separates the two, since the browser escapes a colon to `%3A`.
 */
function toParam(config: ConfigModel.Config | null, entry: DetailsSubject): string | undefined {
  const name = nameOf(config, entry);
  return name && `${entry.collection}.${name}`;
}

/**
 * The entry an address names, or null when it names none.
 *
 * Splits at the first full stop only, since device names can contain them.
 * Anything it cannot parse, including older forms such as `drives.0` or
 * `result`, means a closed panel rather than an error.
 */
function fromParam(config: ConfigModel.Config | null, value: string | null): DetailsSubject | null {
  if (!value) return null;

  const dot = value.indexOf(".");
  if (dot < 0) return null;

  const collection = value.slice(0, dot) as DetailsCollection;
  const name = value.slice(dot + 1);
  if (!COLLECTIONS.includes(collection)) return null;

  const entries = config?.[collection] || [];
  const index = entries.findIndex((_, i) => nameOf(config, { collection, index: i }) === name);

  return index < 0 ? null : { collection, index };
}

/**
 * The address with the panel showing `param`, or closed when `param` is null.
 *
 * Panel state kept in the address, such as an expanded list, is dropped when
 * the panel closes or moves to another device.
 */
function withDetails(params: URLSearchParams, param: string | undefined): URLSearchParams {
  if (param && params.get(DEVICE_DETAILS) === param) return params;

  const tokens = (params.get(EXPANDED)?.split(",") ?? []).filter((t) => t !== CURRENT_CONTENT);
  if (tokens.length) {
    params.set(EXPANDED, tokens.join(","));
  } else {
    params.delete(EXPANDED);
  }

  if (param) {
    params.set(DEVICE_DETAILS, param);
  } else {
    params.delete(DEVICE_DETAILS);
  }

  return params;
}

/**
 * The query of an address, updated so a panel open on a renamed volume group
 * follows the new name. Any other address is returned unchanged.
 *
 * @example
 * renamedGroupSearch("?device=volumeGroups.system", "system", "data");
 * // "?device=volumeGroups.data"
 */
function renamedGroupSearch(search: string, from: string, to: string): string {
  const params = new URLSearchParams(search);
  if (params.get(DEVICE_DETAILS) !== `volumeGroups.${from}`) return search;

  params.set(DEVICE_DETAILS, `volumeGroups.${to}`);
  return `?${params}`;
}

/**
 * The storage page panel state, kept in the address so it survives reloads and
 * can be shared. Changes replace the address rather than pushing to the
 * history, so Back leaves the page instead of stepping through panels.
 */
function useDeviceDetails(): {
  /** What the panel shows, or null when closed. */
  subject: DetailsSubject | null;
  /** The address opening the panel on the given entry. */
  addressOf: (subject: DetailsSubject) => To;
  /** The address name of an entry, such as `drives.vdb`, unique on the page. */
  keyOf: (subject: DetailsSubject) => string | undefined;
  /** Opens the panel, for controls that cannot be links, such as menu items. */
  openDetails: (subject: DetailsSubject) => void;
  /**
   * Whether the address names an entry the panel cannot show, such as a removed
   * one. The panel is closed then, and its owner should clear the address.
   */
  isStale: boolean;
  /** Closes the panel. */
  close: () => void;
} {
  const config = useConfigModel();
  const [params, setParams] = useSearchParams();
  const value = params.get(DEVICE_DETAILS);
  const subject = fromParam(config, value);

  /* An entry without a name leaves the address unchanged. */
  const addressOf = (subject: DetailsSubject): To => {
    const param = toParam(config, subject);
    const next = new URLSearchParams(params);
    return { search: `?${param ? withDetails(next, param) : next}` };
  };

  const openDetails = (subject: DetailsSubject) =>
    setParams((next) => {
      const param = toParam(config, subject);
      return param ? withDetails(next, param) : next;
    }, SEARCH_PARAM_UPDATE);

  const close = () => setParams((next) => withDetails(next, undefined), SEARCH_PARAM_UPDATE);

  const keyOf = (subject: DetailsSubject) => toParam(config, subject);

  return { subject, addressOf, keyOf, openDetails, isStale: value !== null && !subject, close };
}

export { useDeviceDetails, renamedGroupSearch, DETAILS_PANEL_ID };
export type { DetailsSubject, DetailsCollection };
