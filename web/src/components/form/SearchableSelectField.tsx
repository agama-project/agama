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

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
} from "@patternfly/react-core";
import { debounce } from "radashi";
import { useFieldContext } from "~/hooks/form";

// Lowercases and strips diacritics so a query without accents still matches
// accented text (e.g. typing "ingles" matches "Inglés"). Both the query and the
// option text are sanitized the same way before they are compared.
const sanitizeForSearch = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

type Option = {
  value: string;
  label: string;
  // Extra content shown under the label in the open list. Purely visual: it is
  // rendered but never searched, so it may be any node (styled, multi-part).
  // Put anything that must be matched into `filterText` instead.
  description?: React.ReactNode;
  // The text the filter matches against for this option. Provide the complete
  // string to search, including the label text plus any hidden terms (e.g. a
  // code or territory not present in the label). When omitted, the visible
  // `label` is used. The `description` node is never part of the match.
  filterText?: string;
};

type SearchableSelectFieldProps = {
  label: string;
  options: Option[];
  // Builds the text shown in the closed field for the committed option. Defaults
  // to the option's label alone; provide this to show more (e.g. append the
  // description to disambiguate look-alike labels).
  selectedLabel?: (option: Option) => string;
  // FIXME: required for now so callers reuse an already-translated string during
  // the string freeze. Once new strings are allowed, give it a default (e.g.
  // _("Select an option")) and make it optional again.
  placeholder: string;
  // FIXME: required for now so callers reuse an already-translated string during
  // the string freeze. Once new strings are allowed, give it a default (e.g.
  // _("No options found")) and make it optional again.
  noResultsText: string;
  // Last-resort callback to rewrite the filter query before it is used to filter
  // the list. The "query" is the text the user typed into the field; this returns
  // the text to filter with instead, while the input keeps showing what the user
  // actually typed. Use it for the rare case where a natural way of typing should
  // match an option it otherwise would not, e.g. mapping a typed "UTC+1" to the
  // "+1" an option keeps for filtering.
  //
  // Keep it tightly scoped to the token it targets: a broader rewrite silently
  // changes what matches. Defaults to identity (the query filters as typed).
  normalizeQuery?: (query: string) => string;
  // Prompt shown when the field is empty and at rest (no value and not focused),
  // e.g. "Choose an option". While focused or open, `placeholder` is shown
  // instead to hint at filtering. Defaults to `placeholder` when omitted.
  emptyPlaceholder?: string;
  // When true, emptying the input and leaving the field (Tab, Enter or clicking
  // away) clears the selection. When false, leaving with an empty input keeps
  // the previously selected value. Escape always reverts, never clears.
  clearable?: boolean;
  maxHeight?: string;
};

/**
 * Searchable select field built on PatternFly's `<Select variant="typeahead">`
 * and following the W3C "Editable Combobox With List Autocomplete" ARIA
 * pattern: typing filters the list, but the input is not auto-completed inline.
 *
 * While focused or open, `placeholder` hints that typing filters the list; at
 * rest with no selection, `emptyPlaceholder` prompts the user to choose. Once an
 * option is committed the toggle shows a plain selection.
 *
 * DOM focus stays on the text input at all times. List navigation is
 * communicated to assistive technologies via `aria-activedescendant`: the
 * input never loses focus during keyboard navigation.
 *
 * Keyboard behaviour:
 * - ArrowDown / ArrowUp (closed): open the list, highlighting the first / last option
 * - ArrowDown / ArrowUp (open): move the highlight, wrapping at both ends
 * - Enter / Tab: commit the highlighted option; with `clearable` and an emptied
 *   query, clear the selection instead, otherwise keep the current value
 *   (Tab then advances focus)
 * - Escape: close the list and revert to the current selection
 * - Typing: filter the list, opening it when closed
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/
 *
 * @example
 * ```tsx
 * <form.AppField name="language">
 *   {(field) => (
 *     <field.SearchableSelectField
 *       label="Language"
 *       placeholder={_("Filter by language, territory or locale code")}
 *       emptyPlaceholder={_("Choose an option")}
 *       noResultsText={_("None of the locales match the filter.")}
 *       selectedLabel={(o) => `${o.label} (${o.value})`}
 *       options={[
 *         // `description` is shown but not searched; `filterText` (label + code)
 *         // is what the filter matches against.
 *         { value: "en_US", label: "English", description: "United States", filterText: "English United States en_US" },
 *         { value: "es_ES", label: "Spanish", description: "Spain", filterText: "Spanish Spain es_ES" }
 *       ]}
 *     />
 *   )}
 * </form.AppField>
 * ```
 */
export default function SearchableSelectField({
  label,
  options,
  selectedLabel,
  placeholder,
  noResultsText,
  normalizeQuery,
  emptyPlaceholder,
  clearable = false,
  maxHeight = "300px",
}: SearchableSelectFieldProps) {
  const field = useFieldContext<string>();
  const error = field.state.meta.errors[0];
  const [isOpen, setIsOpen] = useState(false);
  // What the input shows, updated on every keystroke for responsive typing.
  const [filterValue, setFilterValue] = useState("");
  // What actually filters the list, updated on a short debounce so a fast burst
  // of keystrokes reflows the (potentially long) list once instead of per key.
  const [appliedFilter, setAppliedFilter] = useState("");
  // True once the user edits the text. Distinguishes an empty field the user
  // just cleared (keep it empty) from one just opened (show the selection).
  const [isFiltering, setIsFiltering] = useState(false);
  // Index of the visually-highlighted option; navigation never moves real
  // DOM focus out of the input, AT is notified via aria-activedescendant.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // While the user drives the list with the keyboard, the option list ignores
  // the mouse. Otherwise the list reflowing under a stationary cursor flashes
  // the hover highlight across the rows it slides past. The mouse is restored on
  // the next real movement (see the mousemove effect below).
  //
  // pointer-events does not block keyboard focus, so this never traps the user.
  // @see https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
  const [pointerInert, setPointerInert] = useState(false);
  // Whether the text input currently holds focus, used to switch the empty-field
  // placeholder between the resting prompt and the filter hint.
  const [isInputFocused, setIsInputFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Stable prefix for option element IDs referenced by aria-activedescendant.
  const idPrefix = useId();
  const optionId = (index: number) => `${idPrefix}-option-${index}`;

  // Debounced writer for the applied filter, so a burst of keystrokes reflows
  // the list once. Created per instance (memoized to stay stable across renders),
  // not at module level, so two fields on a page never share one timer.
  const debouncedApplyFilter = useMemo(() => debounce({ delay: 150 }, setAppliedFilter), []);

  // Cancel a pending debounce on unmount.
  useEffect(() => () => debouncedApplyFilter.cancel(), [debouncedApplyFilter]);

  // Clearing applies at once (no point debouncing an empty query); any other
  // value goes through the debounce.
  const applyFilter = (value: string) => {
    if (value === "") {
      debouncedApplyFilter.cancel();
      setAppliedFilter("");
    } else {
      debouncedApplyFilter(value);
    }
  };

  /** Derived state */

  // Precompute each option's sanitized match text once, keyed by value, so a
  // burst of keystrokes filters against a ready string instead of rebuilding it
  // per option per render. `filterText` is the full text to search (label
  // included); the visible `label` is the fallback. `description` is never here.
  const haystacks = useMemo(
    () => new Map(options.map((o) => [o.value, sanitizeForSearch(o.filterText ?? o.label)])),
    [options],
  );

  const filteredOptions = useMemo(() => {
    const query = normalizeQuery ? normalizeQuery(appliedFilter) : appliedFilter;
    const terms = sanitizeForSearch(query).trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return options;
    // Match each whitespace-separated term against the option's haystack, so a
    // query spanning several pieces (e.g. "Spanish Argentina") still matches
    // regardless of word order.
    return options.filter((o) => {
      const haystack = haystacks.get(o.value) ?? "";
      return terms.every((term) => haystack.includes(term));
    });
  }, [options, appliedFilter, haystacks, normalizeQuery]);

  const selectedOption = options.find((o) => o.value === field.state.value);

  // Text shown when not actively filtering: the committed selection, or empty.
  const selectionDisplayValue = selectedOption
    ? (selectedLabel?.(selectedOption) ?? selectedOption.label)
    : "";
  // While filtering, the input reflects exactly what the user typed (including
  // an empty string they cleared); otherwise it shows the current selection, so
  // opening the list keeps the previous choice visible instead of wiping it.
  const inputDisplayValue = isFiltering ? filterValue : selectionDisplayValue;

  // Empty-field placeholder: while the user is engaged (focused or open) it
  // hints at filtering; at rest it shows the prompt to make a selection.
  const isEngaged = isOpen || isInputFocused;
  const inputPlaceholder = isEngaged ? placeholder : (emptyPlaceholder ?? placeholder);

  // Option that Enter/Tab will commit: the one the user arrowed to, or, when a
  // non-empty query is active, its first match (so typing then pressing Tab
  // selects it). An empty query highlights nothing, so clearing the field and
  // tabbing away selects nothing rather than the first option.
  const hasQuery = appliedFilter.trim().length > 0;
  const resolveHighlightedIndex = (): number | null => {
    if (activeIndex !== null) return activeIndex;
    if (hasQuery && filteredOptions.length > 0) return 0;
    return null;
  };
  const highlightedIndex = resolveHighlightedIndex();

  // Re-enable mouse interaction on the next real pointer movement, so hover and
  // clicks work again as soon as the user reaches for the mouse.
  useEffect(() => {
    if (!pointerInert) return;
    const restore = () => setPointerInert(false);
    window.addEventListener("mousemove", restore, { once: true });
    return () => window.removeEventListener("mousemove", restore);
  }, [pointerInert]);

  /** Helpers */

  const closeList = () => {
    setIsOpen(false);
    setFilterValue("");
    debouncedApplyFilter.cancel();
    setAppliedFilter("");
    setIsFiltering(false);
    setActiveIndex(null);
  };

  /**
   * Scroll an option into view once the list has rendered. The open list may
   * live in a portal, so the option is located by id rather than through a
   * container ref.
   */
  const scrollOptionIntoView = (index: number) => {
    setTimeout(() => {
      document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" });
    }, 0);
  };

  const scrollToSelected = () => {
    const idx = options.findIndex((o) => o.value === field.state.value);
    if (idx !== -1) scrollOptionIntoView(idx);
  };

  const openList = () => {
    setIsOpen(true);
    scrollToSelected();
  };

  // Opens the list to browse: the current selection stays shown and the full
  // list is visible until the user starts typing.
  const openForBrowsing = () => {
    setIsFiltering(false);
    openList();
    // Pre-select the shown text so the current value is kept but a single
    // keystroke types over it. Only on browse: when the list opens as a side
    // effect of typing, re-selecting would fight the edit the user just made.
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitOption = (index: number) => {
    const option = filteredOptions[index];
    if (!option) return;
    field.handleChange(option.value);
    closeList();
  };

  // Resolves the field value when leaving the open list: commit the highlighted
  // option, or - when `clearable` and the user emptied the query - clear the
  // selection; otherwise keep the current value. Escape bypasses this on purpose.
  const leaveField = () => {
    if (highlightedIndex !== null) {
      commitOption(highlightedIndex);
      return;
    }
    if (clearable && isFiltering && filterValue.trim() === "") {
      field.handleChange("");
    }
    closeList();
  };

  const moveActive = (direction: "next" | "prev") => {
    const count = filteredOptions.length;
    if (count === 0) return;

    // Move relative to whatever is currently highlighted (an arrowed option or
    // the auto-highlighted first match), wrapping at both ends.
    const current = highlightedIndex;
    let next: number;
    if (direction === "next") {
      next = current === null ? 0 : (current + 1) % count;
    } else {
      next = current === null ? count - 1 : (current - 1 + count) % count;
    }

    setActiveIndex(next);
    scrollOptionIntoView(next);
    setPointerInert(true);
  };

  /** Keyboard handlers */

  // Passed to <Select onToggleKeydown>; PF calls it for key events on the
  // toggle when variant="typeahead", skipping its own arrow-key default.
  const onToggleKeydown = (e: React.KeyboardEvent | KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) openForBrowsing();
      moveActive("next");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) openForBrowsing();
      moveActive("prev");
    } else if (e.key === "Enter" && isOpen) {
      e.preventDefault();
      leaveField();
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      // Resolve the pending state before focus moves away naturally.
      // No preventDefault: Tab must still advance focus.
      if (isOpen) leaveField();
      else closeList();
      return;
    }

    if (e.key === "Escape") {
      // Stop propagation so PF's own Escape handler doesn't also fire.
      e.stopPropagation();
      if (isOpen) {
        closeList();
      } else if (filterValue) {
        setFilterValue("");
        applyFilter("");
      }
    }
  };

  /** Toggle */
  // MenuToggle variant="typeahead" renders a <div> (not a <button>), passes
  // children through verbatim, and injects the caret in its own
  // <button tabIndex={-1}>, so the input is the only Tab stop in the toggle.

  const toggle = (pfRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={pfRef as React.Ref<HTMLButtonElement>}
      variant="typeahead"
      isExpanded={isOpen}
      isFullWidth
      onClick={() => (isOpen ? closeList() : openForBrowsing())}
      // Lands on PF's caret <button>, whose default name is the untranslated
      // "Menu toggle"; reusing the field label avoids that English default.
      // TODO (post-freeze): give the caret its own translated, purpose-specific
      // label (e.g. "Show options") instead of duplicating the field label.
      aria-label={label}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          // Permanent focus owner: it is never blurred during list navigation.
          ref={inputRef}
          // inputId (not id) puts this on the inner input; a plain id would land
          // on the wrapper. Matches the FormGroup's fieldId so its visible label
          // labels the combobox input and clicking the label focuses it.
          inputId={`${idPrefix}-input`}
          // PF defaults the input's aria-label to "Type to filter", which would
          // override the visible label as the accessible name; keep them aligned.
          aria-label={label}
          value={inputDisplayValue}
          onChange={(_e, value) => {
            setFilterValue(value);
            applyFilter(value);
            setIsFiltering(true);
            setActiveIndex(null);
            setPointerInert(true);
            if (!isOpen) openList();
          }}
          onKeyDown={onInputKeyDown}
          onClick={(e) => {
            // While open, stop the click reaching the toggle, which would read
            // it as a toggle press and close the list. While closed, open this
            // list and let the click bubble so PF's outside-click handler closes
            // any other field's open list (which it cannot do if stopped here).
            if (isOpen) {
              e.stopPropagation();
            } else {
              openForBrowsing();
            }
          }}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          // ARIA combobox wiring (W3C APG list-autocomplete). PF applies none of
          // these unless passed; together they make the input a combobox whose
          // listbox is driven by aria-activedescendant, so focus never leaves it:
          // - role + aria-autocomplete: a combobox that filters a list
          // - aria-expanded + aria-controls: the listbox's open state and id
          // - aria-activedescendant: the highlighted option (virtual focus)
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={`${idPrefix}-listbox`}
          aria-activedescendant={highlightedIndex !== null ? optionId(highlightedIndex) : undefined}
          placeholder={inputPlaceholder}
          autoComplete="off"
          // PF spreads unknown props onto the wrapper, not the input; invalid
          // state must reach the input itself, so it goes through inputProps.
          inputProps={
            error ? { "aria-invalid": true, "aria-describedby": `${idPrefix}-error` } : undefined
          }
        />
      </TextInputGroup>
    </MenuToggle>
  );

  /** Render */

  return (
    <FormGroup label={label} fieldId={`${idPrefix}-input`}>
      <Select
        id={field.name}
        variant="typeahead"
        isOpen={isOpen}
        selected={field.state.value}
        onSelect={(_e, value) => {
          if (typeof value !== "string") return;
          const idx = filteredOptions.findIndex((o) => o.value === value);
          if (idx !== -1) commitOption(idx);
        }}
        onOpenChange={(open) => {
          // PF-initiated close (outside click): resolve the pending state the
          // same way Tab/Enter do, so clicking away clears when appropriate.
          if (!open) leaveField();
        }}
        // Hand all arrow/Enter handling to our onToggleKeydown so PF doesn't
        // apply its default behaviour (moving real DOM focus into list items).
        onToggleKeydown={onToggleKeydown}
        toggle={toggle}
      >
        <SelectList
          id={`${idPrefix}-listbox`}
          style={{ maxHeight, overflowY: "auto", pointerEvents: pointerInert ? "none" : undefined }}
        >
          {filteredOptions.length === 0 ? (
            <SelectOption isDisabled key="no-results">
              {noResultsText}
            </SelectOption>
          ) : (
            filteredOptions.map((option, index) => (
              <SelectOption
                key={option.value}
                id={optionId(index)}
                value={option.value}
                description={option.description}
                // isFocused applies PF's own highlight class, giving sighted
                // users the same visual cue AT users get via aria-activedescendant.
                // Hover does not drive this highlight: while filtering the list
                // shifts under a stationary cursor, and letting mouse-enter move
                // the highlight then fights the keyboard one and flickers.
                isFocused={index === highlightedIndex}
              >
                {option.label}
              </SelectOption>
            ))
          )}
        </SelectList>
      </Select>
      {error && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem id={`${idPrefix}-error`} variant="error">
              {error}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
}
