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

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { SEARCH_PARAM_UPDATE } from "~/hooks/use-search-param-state";

/** How long typing pauses before the address is updated, in milliseconds. */
const DEBOUNCE_DELAY = 300;

/** Value of a choice filter that narrows nothing down. */
const ALL = "all";

/** A filter the user types into, such as a name or a bound of a range. */
type TextFilter = { kind: "text" };

/** A filter the user picks from a list, such as a status. */
type ChoiceFilter<V extends string> = { kind: "choice"; values: readonly V[] };

type Filter = TextFilter | ChoiceFilter<string>;

/** Text waiting for typing to pause, and what the address held when it started. */
type PendingText = { typed: string; base: string };

/** How a table describes the filters it keeps in the address. */
type FilterSpecs = Record<string, Filter>;

/**
 * What each filter reads as: one of its own values or "all" for a choice, and
 * whatever was typed for a text filter.
 */
type FilterValues<S extends FilterSpecs> = {
  [K in keyof S]: S[K] extends ChoiceFilter<infer V> ? V | typeof ALL : string;
};

/**
 * Describes a filter the user types into.
 *
 * @example
 * name: textFilter()
 */
function textFilter(): TextFilter {
  return { kind: "text" };
}

/**
 * Describes a filter the user picks from a list.
 *
 * The values are the ones the filter offers besides "all", and they are also
 * what an address is checked against, so a link naming something else opens the
 * table unfiltered rather than empty.
 *
 * @example
 * status: choiceFilter(["active", "offline"])
 */
function choiceFilter<V extends string>(values: readonly V[]): ChoiceFilter<V> {
  return { kind: "choice", values };
}

/**
 * Keeps the filters of a table in the URL, so that reloading the page or
 * sharing its address brings the same rows back.
 *
 * A filter is named once, and that name is what appears in the address:
 * `status: choiceFilter(...)` reads and writes `?status=`. Addresses describe
 * themselves that way, which is what makes them worth reading, sharing and
 * editing by hand.
 *
 * A filter left at its default, "all" for a choice and empty for a text one,
 * has no param at all: a view has one address that way, rather than one for the
 * table as it opens and another for the same table after a filter travelled
 * back to where it started.
 *
 * Text filters reach the address once typing pauses, while the value shown
 * follows the keyboard as usual. Writing per keystroke instead would flood the
 * history and make the back button undo letters.
 *
 * `resetFilters` drops every param of the table in a single update, and drops
 * what was typed most recently along with them. Both matter: clearing the
 * params one by one would not work, since each update starts from the params of
 * the render it was made in, and a keystroke still waiting for the pause would
 * otherwise land right after the clearing and put the filter back.
 *
 * @example
 * const { filters, setFilter, resetFilters, hasActiveFilters } = useFilterParams({
 *   name: textFilter(),
 *   status: choiceFilter(["active", "offline"]),
 * });
 *
 * <TextinputFilter value={filters.name} onChange={(_, v) => setFilter("name", v)} />
 * <SimpleSelector value={filters.status} onChange={(_, v) => setFilter("status", v)} />
 */
function useFilterParams<S extends FilterSpecs>(specs: S) {
  const [params, setParams] = useSearchParams();
  // What text filters show while their update waits for typing to pause,
  // remembered along with what the address held when the typing started.
  const [pendingText, setPendingText] = useState<Record<string, PendingText>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const write = (param: string, value: string | undefined) =>
    setParams((nextParams) => {
      if (value === undefined) {
        nextParams.delete(param);
      } else {
        nextParams.set(param, value);
      }
      return nextParams;
    }, SEARCH_PARAM_UPDATE);

  const read = (name: string, filter: Filter): string => {
    const value = params.get(name);

    if (filter.kind !== "text") return filter.values.find((option) => option === value) ?? ALL;

    // What was typed counts until the address moves, either because the pause
    // arrived and the update landed, or because something else changed the
    // filter. Deciding it here rather than storing the transition keeps a
    // settled value from costing a render of its own.
    const pending = pendingText[name];
    if (pending && (value ?? "") === pending.base) return pending.typed;

    return value ?? "";
  };

  const filters = Object.fromEntries(
    Object.entries(specs).map(([name, filter]) => [name, read(name, filter)]),
  ) as FilterValues<S>;

  const hasActiveFilters = Object.entries(specs).some(([name, filter]) => {
    const value = read(name, filter);

    return filter.kind === "text" ? value !== "" : value !== ALL;
  });

  const setFilter = <K extends keyof S & string>(name: K, value: string) => {
    const filter = specs[name];

    if (filter.kind === "choice") {
      write(name, value === ALL ? undefined : value);
      return;
    }

    setPendingText((pending) => ({
      ...pending,
      [name]: { typed: value, base: params.get(name) ?? "" },
    }));
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(
      () => write(name, value === "" ? undefined : value),
      DEBOUNCE_DELAY,
    );
  };

  const resetFilters = () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    if (Object.keys(pendingText).length) setPendingText({});
    setParams((nextParams) => {
      Object.keys(specs).forEach((name) => nextParams.delete(name));
      return nextParams;
    }, SEARCH_PARAM_UPDATE);
  };

  return { filters, setFilter, resetFilters, hasActiveFilters };
}

export default useFilterParams;
export { textFilter, choiceFilter };
