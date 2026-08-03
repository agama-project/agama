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
import { toggle } from "radashi";

/**
 * How UI state is written to the URL.
 *
 * Replacing keeps back and forward stepping between pages instead of between
 * individual clicks on the same page, and the scroll position of the page is
 * left untouched.
 *
 * Note that every update here is a router navigation, so a navigation blocker
 * sees it too: one that does not compare paths would fire while the user is
 * merely changing how the current page looks, and would cancel the update.
 */
const SEARCH_PARAM_UPDATE = { replace: true, preventScrollReset: true } as const;

/**
 * A single piece of UI state stored in a URL search param.
 *
 * Useful for any value that describes how the current page is being looked at,
 * such as the selected tab or the sorted column, so that reloading the page or
 * sharing its address brings the same view back.
 *
 * Setting `undefined` removes the param, and so does setting `defaultValue`
 * itself: a view has one address that way, instead of one for the page as it
 * opens and another for the same page after a control travelled back to where
 * it started. Reading never rewrites anything, so an address that spells the
 * default out keeps it.
 *
 * @example
 * const [tab, setTab] = useSearchParamState("tab", "0");
 *
 * <Tabs activeKey={tab} onSelect={(_, key) => setTab(key)} />
 */
function useSearchParamState(key: string, defaultValue?: string) {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? defaultValue;

  const setValue = (next: string | number | undefined) =>
    setParams((nextParams) => {
      if (next === undefined || String(next) === defaultValue) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, String(next));
      }
      return nextParams;
    }, SEARCH_PARAM_UPDATE);

  return [value, setValue] as const;
}

/**
 * A set of tokens stored comma-joined in a single URL search param.
 *
 * Suited to on/off state for a collection of elements, like the expanded
 * sections of a page or the selected filters of a table. The param disappears
 * from the address once the set is empty.
 *
 * Callers decide how a token identifies its element; keep those derivations
 * next to the page that owns them.
 *
 * The returned functions ask and answer about the tokens, not about the param:
 * `hasSearchParamToken("d0")` tells whether `d0` is one of the values, not
 * whether a param named `d0` exists.
 *
 * @example
 * const { hasSearchParamToken, toggleSearchParamToken } = useSearchParamTokens("e");
 *
 * <ExpandableSectionToggle
 *   isExpanded={hasSearchParamToken(sectionId)}
 *   onToggle={() => toggleSearchParamToken(sectionId)}
 * />
 */
function useSearchParamTokens(key: string) {
  const [params, setParams] = useSearchParams();
  const tokens = params.get(key)?.split(",") ?? [];

  const hasSearchParamToken = (token: string) => tokens.includes(token);

  const toggleSearchParamToken = (token: string) =>
    setParams((nextParams) => {
      const nextTokens = toggle(nextParams.get(key)?.split(",") ?? [], token);
      if (nextTokens.length) {
        nextParams.set(key, nextTokens.join(","));
      } else {
        nextParams.delete(key);
      }
      return nextParams;
    }, SEARCH_PARAM_UPDATE);

  return { tokens, hasSearchParamToken, toggleSearchParamToken };
}

/**
 * Returns a function that drops the given params from the URL in a single
 * update.
 *
 * Useful for actions that reset several pieces of UI state at once. Clearing
 * them one by one would not work: each setter starts from the params of the
 * render it was created in, so the last call would undo the previous ones.
 *
 * @example
 * const clearSearchParams = useClearSearchParams();
 *
 * const onReset = () => clearSearchParams(EXPANDED, SETTINGS_TAB);
 */
function useClearSearchParams() {
  const [, setParams] = useSearchParams();

  return (...keys: string[]) =>
    setParams((nextParams) => {
      keys.forEach((key) => nextParams.delete(key));
      return nextParams;
    }, SEARCH_PARAM_UPDATE);
}

export { SEARCH_PARAM_UPDATE, useSearchParamState, useSearchParamTokens, useClearSearchParams };
