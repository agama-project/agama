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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { debounce, sift, unique } from "radashi";
import {
  Button,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Text from "~/components/core/Text";
import MultiSelectEntries from "~/components/form/MultiSelectEntries";
import MultiSelectOptionList from "~/components/form/MultiSelectOptionList";
import { normalizeValue, parsePasteEntries, processDraft } from "~/components/form/entry-helpers";
import { buildHaystacks, filterOptions } from "~/components/form/option-filter";
import {
  buildEntryStops,
  buildOptionRows,
  findExactOption,
  layoutEntries,
} from "~/components/form/multi-select-rows";
import {
  allValuesRemoved,
  contextualHint,
  filterOutcome,
  focusHintSentences,
  overflowState,
  pasteSummary,
  sightedHint,
  valueAdded,
  valueAlreadySelected,
  valueMovedToInput,
  valueNotAvailable,
  valueRemoved,
  valueShownInList,
  withHint,
} from "~/components/form/multi-select-messages";
import { useMultiSelectKeyboard } from "~/hooks/use-multi-select-keyboard";
import { resolveAriaLabelProps, useFieldLabel } from "~/hooks/use-field-label";
import { useFieldContext } from "~/hooks/form-contexts";
import { useAnnounce } from "~/context/announcer";
import { _ } from "~/i18n";

import type { FieldPart, HintContext } from "~/components/form/multi-select-messages";
import type { FieldLabelOptions } from "~/hooks/use-field-label";
import type { FooterEntry } from "~/components/form/FooterEntryOption";
import type { EntryStop, MultiSelectOption, OptionRow } from "~/components/form/multi-select-rows";
import type { MultiSelectKeyboard } from "~/hooks/use-multi-select-keyboard";
import type { TranslatedString } from "~/i18n";

/** What a pasted text is cut into values by, when the caller says nothing. */
const PASTE_SEPARATORS = /[\s,;]+/;

/** How long the typing has to stop before the outcome of the filter is said. */
const FILTER_ANNOUNCE_DELAY = 500;

/** Drops the quotation marks wrapping a pasted value. */
function sanitizePastedValue(text: string): string {
  return text.replace(/^["']/, "").replace(/["']$/, "");
}

/** Every DOM id the field hands out, all built from the field name. */
function fieldIds(name: string) {
  return {
    input: name,
    listbox: `${name}-listbox`,
    entriesName: `${name}-entries-name`,
    hint: `${name}-hint`,
    instructions: `${name}-instructions`,
    summary: `${name}-summary`,
    clearAll: `${name}-clear-all`,
    entry: (index: number) => `${name}-entry-${index}`,
    row: (index: number) => `${name}-row-${index}`,
  };
}

/**
 * The instructions a screen reader reads when the field takes focus.
 *
 * Always rendered, never shown, and pointed at by the input. Only says how to
 * reach each part of the field: what each part offers is told when the user
 * gets there.
 */
function ScreenReaderInstructions({
  id,
  sentences,
}: {
  id: string;
  sentences: TranslatedString[];
}) {
  return (
    <HelperTextItem id={id}>
      {sentences.map((sentence) => (
        <Text key={sentence} srOnly>
          {sentence}
        </Text>
      ))}
    </HelperTextItem>
  );
}

/** The same instructions for sighted users, once they are working on the field. */
function SightedInstructions({ hasEntries, isDirty }: { hasEntries: boolean; isDirty: boolean }) {
  if (!isDirty) return null;

  return (
    <HelperTextItem>
      <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{sightedHint(hasEntries)}</Text>
    </HelperTextItem>
  );
}

type MultiSelectFieldProps = FieldLabelOptions & {
  /**
   * Label rendered by PatternFly's FormGroup.
   *
   * Either a translated string (wrapped with `_()`) or a ReactNode (e.g.
   * `LabelText` with a suffix). Plain untranslated strings are rejected at the
   * type level.
   */
  label: TranslatedString | Exclude<React.ReactNode, string>;

  /** The values the field offers. */
  options: MultiSelectOption[];

  /**
   * Whether the field also takes values that are not among the options.
   *
   * Those values are drawn outlined, so they read as something the user
   * brought in themselves. Without this, text matching no option is refused
   * and the refusal is announced.
   */
  allowCustomEntries?: boolean;

  /**
   * Whether a Tab that commits something keeps focus in the field.
   *
   * With nothing to commit, Tab always moves focus on, so the field can never
   * hold the user in.
   */
  tabKeepsFocus?: boolean;

  /**
   * Whether the list stays open with a row saying nothing matches.
   *
   * By default the list hides instead, as the combobox pattern does. The list
   * is never empty while it has the row that takes the text as typed or an
   * entry leading elsewhere.
   */
  showNoResults?: boolean;

  /**
   * How many values the control shows before summarizing the rest as "N more".
   *
   * Zero, the default, always shows every value. Values the user typed in are
   * never the ones summarized.
   */
  entriesThreshold?: number;

  /**
   * What the summary does.
   *
   * With `expandOnFocus` every value is shown while the field has focus, and
   * the summary comes back when focus leaves. With `toggle` the summary is one
   * more stop for the keyboard, which switches between showing all and
   * summarizing.
   */
  overflowBehavior?: "expandOnFocus" | "toggle";

  /** An entry rendered last in the list, offering something other than a value. */
  footerEntry?: FooterEntry;

  /**
   * Per-value validator that runs on every commit.
   *
   * Invalid values are marked and announced right away. Use for checks that
   * are always safe to run early, such as a name format.
   */
  validateOnChange?: (value: string) => string | undefined;

  /**
   * Per-value validator that runs only after the first failed form submit.
   *
   * Stays silent until TanStack Form sets an error on this field.
   */
  validateOnSubmit?: (value: string) => string | undefined;

  /** Tidies up a value the user typed before it is committed. */
  normalize?: (value: string) => string;

  /**
   * Formats a committed value for display.
   *
   * Only used for values that match no option: a value the field offers is
   * shown with the option's label.
   */
  displayValue?: (value: string) => string;

  /**
   * Pattern the pasted text is cut into values by.
   *
   * Defaults to blanks, commas and semicolons. Quotation marks around a value
   * are always dropped.
   */
  splitPasteOn?: RegExp | string;

  /** Prompt shown while the text box is empty. */
  placeholder?: TranslatedString;

  /** Guidance shown under the field. */
  helperText?: React.ReactNode;

  /** Disables the text box and every action on the values. */
  isDisabled?: boolean;

  /**
   * Widest a value is drawn, in "ch" units. Longer ones are shortened in the
   * middle. Without it, values are drawn whole.
   */
  maxEntryWidth?: number;
};

/**
 * A form field that takes several values out of a list, and optionally values
 * the user writes out.
 *
 * The values sit inside the control as labels, before a text box that filters
 * the list as the user types. A value the field offers is drawn filled, one
 * the user wrote out is outlined, since only the first can be found again in
 * the list. Values are never repeated: adding one the field already holds
 * changes nothing and is announced.
 *
 * The field follows the W3C "Editable Combobox With List Autocomplete"
 * pattern: the text box is the combobox and the only tab stop, and it keeps
 * real focus at all times. Everything else the keyboard can reach, the options
 * and the values already added, is pointed at with `aria-activedescendant`
 * instead of taking focus. Because that attribute points at one thing at a
 * time, the keyboard is in one part of the field at a time; see
 * {@link useMultiSelectKeyboard} for the whole contract.
 *
 * Validation of the form is deferred to submit, as everywhere else; the
 * per-value validators are about the shape of a single value.
 *
 * Both sighted and assistive technology users get the same feedback: an
 * invalid value carries its error in its accessible name, and everything that
 * happens is announced through the application-wide live region (see
 * {@link useAnnounce}).
 *
 * Must be used inside a TanStack Form `AppField` context holding a `string[]`.
 *
 * @see useFieldContext for field component conventions.
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/
 *
 * @example
 * <form.AppField name="bondPorts">
 *   {(field) => (
 *     <field.MultiSelectField
 *       label={_("Bond ports")}
 *       options={deviceOptions}
 *       allowCustomEntries
 *       helperText={_("Choose devices or enter their names.")}
 *       footerEntry={{
 *         label: _("Browse with details..."),
 *         onSelect: openDeviceDialog,
 *         opensDialog: true,
 *       }}
 *     />
 *   )}
 * </form.AppField>
 */
export default function MultiSelectField({
  label,
  options,
  allowCustomEntries = false,
  tabKeepsFocus = true,
  showNoResults = false,
  entriesThreshold = 0,
  overflowBehavior = "expandOnFocus",
  footerEntry,
  validateOnChange,
  validateOnSubmit,
  normalize,
  displayValue,
  splitPasteOn,
  placeholder,
  helperText,
  isDisabled = false,
  maxEntryWidth,
  "aria-label": inputAriaLabel,
  "aria-labelledby": ariaLabelledBy,
  labelPrefixedBy,
}: MultiSelectFieldProps) {
  const field = useFieldContext<string[]>();
  const values = field.state.value;
  const fieldErrors = sift(field.state.meta.errors);
  const announce = useAnnounce();

  const { labelId, labelProps } = useFieldLabel(field.name, {
    "aria-label": inputAriaLabel,
    "aria-labelledby": ariaLabelledBy,
    labelPrefixedBy,
  });
  const inputNameProps = resolveAriaLabelProps(labelProps, { "aria-labelledby": labelId });

  const ids = useMemo(() => fieldIds(field.name), [field.name]);
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  // Lets an action ask the keyboard to move, which is otherwise only the
  // keyboard's own business: choosing a value from the list has to leave the
  // keyboard on it.
  const keyboardRef = useRef<MultiSelectKeyboard | null>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isShowingAll, setIsShowingAll] = useState(false);

  /** Derived state */

  const haystacks = useMemo(() => buildHaystacks(options), [options]);
  const knownValues = useMemo(() => new Set(options.map((o) => o.value)), [options]);
  const isKnown = (value: string) => knownValues.has(value);

  const rowsFor = (text: string): OptionRow[] =>
    buildOptionRows({
      options,
      query: text,
      haystacks,
      allowCustomEntries,
      hasFooterEntry: Boolean(footerEntry),
    });

  const optionRows = rowsFor(query);
  // The list only shows while it has something in it. A field that says so
  // keeps it open with a row telling the user as much.
  const isListVisible = isOpen && (optionRows.length > 0 || showNoResults);

  const toLabel = (value: string) => {
    const option = options.find((o) => o.value === value);
    if (option) return option.label;
    return displayValue ? displayValue(value) : value;
  };

  const errorFor = (value: string): string | undefined =>
    validateOnChange?.(value) || (fieldErrors.length > 0 ? validateOnSubmit?.(value) : undefined);

  // What the control shows once it summarizes, which also says whether there
  // is anything to summarize in the first place.
  const collapsedLayout = layoutEntries({
    values,
    threshold: entriesThreshold,
    isExpanded: false,
    isKnown,
  });
  const hasHiddenValues = collapsedLayout.hiddenCount > 0;
  const showsEveryValue = overflowBehavior === "toggle" ? isShowingAll : isFocused;
  const layout = showsEveryValue
    ? layoutEntries({ values, threshold: entriesThreshold, isExpanded: true, isKnown })
    : collapsedLayout;

  const hasToggle = overflowBehavior === "toggle" && hasHiddenValues;
  const entryStops = buildEntryStops(layout, hasToggle);
  const hasClearAll = !isDisabled && (values.length > 0 || query !== "");

  /** Actions */

  // What the field says as it acts on a key. A hint that follows in the same
  // breath is added to it, so the news is not replaced before it is read.
  const lastSaidRef = useRef<TranslatedString | undefined>(undefined);
  const say = (message: TranslatedString) => {
    lastSaidRef.current = message;
    announce(message);
  };

  const openList = () => setIsOpen(true);
  const closeList = () => setIsOpen(false);
  const clearText = () => setQuery("");

  /** Leaves the keyboard on an option of the list, which shows the filter cleared. */
  const highlightOption = (value: string) => {
    const index = rowsFor("").findIndex(
      (row) => row.kind === "option" && row.option.value === value,
    );
    if (index >= 0) keyboardRef.current?.highlightRow(index);
  };

  /**
   * Adds a value and answers whether the text box was emptied, which is what
   * tells a commit apart from a refusal.
   */
  const addValue = (value: string, error?: string): boolean => {
    setQuery("");

    if (values.includes(value)) {
      say(valueAlreadySelected(toLabel(value)));
      return true;
    }

    field.handleChange([...values, value]);
    say(valueAdded(toLabel(value), error));
    return true;
  };

  const removeValue = (index: number) => {
    const value = values[index];
    field.handleChange(values.filter((_v, i) => i !== index));
    say(valueRemoved(toLabel(value)));
  };

  /** Takes a value out of the field and back into the text box, to be changed. */
  const editValue = (index: number) => {
    const value = values[index];
    field.handleChange(values.filter((_v, i) => i !== index));
    setQuery(value);
    say(valueMovedToInput(toLabel(value)));
  };

  /** Opens the list on a value the field holds, so it can be taken back out. */
  const showInList = (value: string) => {
    setQuery("");
    openList();
    highlightOption(value);
    say(valueShownInList(toLabel(value)));
  };

  /**
   * Commits what the text box holds: the option it names, or the text itself
   * when the field takes values of its own. Answers whether anything was
   * committed.
   */
  const commitText = (): boolean => {
    const text = query.trim();
    if (text === "") return false;

    const exact = findExactOption(options, text);
    if (exact && !exact.isDisabled) return addValue(exact.value);

    if (!allowCustomEntries || exact?.isDisabled) {
      announce(valueNotAvailable(text));
      return false;
    }

    const draft = processDraft(text, normalize, validateOnChange);
    if (!draft) return false;
    return addValue(draft.normalized, draft.error);
  };

  const toggleOption = (value: string) => {
    const index = values.indexOf(value);
    setQuery("");

    if (index >= 0) removeValue(index);
    else addValue(value);

    // The filter is gone, so the list about to be shown is a different one:
    // keep the keyboard on the option it was working with.
    if (keyboardRef.current?.navigation.mode === "options") highlightOption(value);
  };

  const activateRow = (row: OptionRow) => {
    if (row.kind === "footer") {
      closeList();
      keyboardRef.current?.reset();
      footerEntry?.onSelect();
      return;
    }

    if (row.kind === "custom") {
      commitText();
      return;
    }

    if (row.option.isDisabled) return;
    toggleOption(row.option.value);
  };

  const toggleSummary = () => {
    const next = !isShowingAll;
    const shownCount = next ? values.length : collapsedLayout.shown.length;
    setIsShowingAll(next);

    // The summary is the last stop, and flipping it changes how many values
    // come before it. The keyboard goes along with it rather than staying on a
    // place that now belongs to a value.
    if (keyboardRef.current?.navigation.mode === "entries") {
      keyboardRef.current.highlightStop(shownCount);
    }

    say(overflowState(shownCount, values.length));
  };

  const activateStop = (stop: EntryStop) => {
    if (stop.kind === "toggle") {
      toggleSummary();
      return;
    }

    const value = values[stop.index];
    if (isKnown(value)) showInList(value);
    else editValue(stop.index);
  };

  const removeStop = (stop: EntryStop) => {
    if (stop.kind === "value") removeValue(stop.index);
  };

  const clearAll = () => {
    field.handleChange([]);
    setQuery("");
    setIsShowingAll(false);
    say(allValuesRemoved());
  };

  const keyboard = useMultiSelectKeyboard({
    optionRows,
    entryStops,
    isListOpen: isListVisible,
    hasClearAll,
    hasText: query.trim() !== "",
    tabKeepsFocus,
    actions: {
      openList,
      closeList,
      commitText,
      activateRow,
      activateStop,
      removeStop,
      clearText,
      clearAll,
    },
  });
  keyboardRef.current = keyboard;

  const { navigation } = keyboard;
  const activeStop = navigation.mode === "entries" ? entryStops[navigation.index] : undefined;

  const activeDescendant = (): string | undefined => {
    if (navigation.mode === "options") return ids.row(navigation.index);
    if (navigation.mode === "clearAll") return ids.clearAll;
    if (activeStop?.kind === "value") return ids.entry(activeStop.index);
    if (activeStop?.kind === "toggle") return ids.summary;
    return undefined;
  };

  /** Which part of the field is being worked on, for the hint it gets. */
  const activePart = ((): FieldPart | undefined => {
    if (navigation.mode === "options") return "options";
    if (navigation.mode === "clearAll") return "clearAll";
    if (activeStop?.kind === "toggle") return "toggle";
    if (activeStop?.kind === "value") return "entries";
    return undefined;
  })();

  const hintContext: HintContext = {
    allowCustomEntries,
    hasKnownValues: values.some(isKnown),
    hasTypedValues: values.some((value) => !isKnown(value)),
    entriesCount: values.length,
  };
  const hintContextRef = useRef(hintContext);
  hintContextRef.current = hintContext;

  /** Announcements and scrolling */

  // A hint is given once per visit to the field: it explains a part the user
  // has just reached, and repeating it on every step would talk over what the
  // field is saying about the option or value itself.
  const hintedParts = useRef(new Set<FieldPart>());
  useEffect(() => {
    if (!activePart) return;
    if (hintedParts.current.has(activePart)) return;
    hintedParts.current.add(activePart);
    announce(withHint(lastSaidRef.current, contextualHint(activePart, hintContextRef.current)));
  }, [activePart, announce]);

  // Only what the field said about the key just handled can be joined to a
  // hint. This runs after the hint above, which is what reads it.
  useEffect(() => {
    lastSaidRef.current = undefined;
  });

  // The option the keyboard moved to may be out of sight in a long list.
  useEffect(() => {
    if (navigation.mode !== "options") return;
    document.getElementById(ids.row(navigation.index))?.scrollIntoView({ block: "nearest" });
  }, [navigation, ids]);

  // Said once the typing pauses: on every keystroke it would be read instead
  // of the text the user is typing. Made per field, so two of them on a page
  // never share the wait.
  const announceRef = useRef(announce);
  announceRef.current = announce;
  const announceFilterOutcome = useMemo(
    () =>
      debounce({ delay: FILTER_ANNOUNCE_DELAY }, (count: number) =>
        announceRef.current(filterOutcome(count)),
      ),
    [],
  );
  useEffect(() => () => announceFilterOutcome.cancel(), [announceFilterOutcome]);

  /** Event handlers */

  const onQueryChange = (text: string) => {
    setQuery(text);
    keyboard.reset();
    openList();
    announceFilterOutcome(filterOptions(options, text, haystacks).length);
  };

  const onBlur = () => {
    setIsFocused(false);
    hintedParts.current.clear();
    keyboard.reset();
    closeList();
    if (query.trim()) commitText();
  };

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = parsePasteEntries(
      event.clipboardData.getData("text"),
      splitPasteOn ?? PASTE_SEPARATORS,
    ).map(sanitizePastedValue);
    if (pasted.length <= 1) return;
    event.preventDefault();

    const added: string[] = [];
    let duplicates = 0;
    let refused = 0;

    for (const text of pasted) {
      const exact = findExactOption(options, text);
      const value = exact?.value ?? normalizeValue(text, normalize);
      const isAcceptable = Boolean(exact) || allowCustomEntries;

      if (!isAcceptable) refused += 1;
      else if (values.includes(value) || added.includes(value)) duplicates += 1;
      else added.push(value);
    }

    if (added.length > 0) field.handleChange([...values, ...added]);
    setQuery("");
    keyboard.reset();
    say(pasteSummary(added.length, duplicates, refused));
  };

  // A press on the caret, on the button that empties the field, or on a value's
  // own remove button must not take focus off the text box, which drives the
  // whole field.
  const onControlMouseDown = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) event.preventDefault();
  };

  /** Render */

  const entryErrors = unique(sift(values.map(errorFor)));
  const hasAnyError = entryErrors.length > 0 || fieldErrors.length > 0;
  // The summary sticks around while it can be flipped back, and otherwise only
  // for as long as it stands for something.
  const hasSummary = hasHiddenValues && (hasToggle || !showsEveryValue);

  return (
    <FormGroup fieldId={ids.input} label={<span id={labelId}>{label}</span>}>
      <div
        ref={controlRef}
        onClick={() => inputRef.current?.focus()}
        onMouseDown={onControlMouseDown}
      >
        <MenuToggle
          variant="typeahead"
          isFullWidth
          isDisabled={isDisabled}
          isExpanded={isListVisible}
          // Lands on PatternFly's caret button, whose own default name is the
          // untranslated "Menu toggle".
          // TRANSLATORS: accessible name of the arrow that opens the list of
          // values a field offers.
          aria-label={_("Show options")}
          onClick={() => (isListVisible ? closeList() : openList())}
        >
          <TextInputGroup
            isDisabled={isDisabled}
            className={(hasAnyError && "pf-m-error") || undefined}
          >
            <TextInputGroupMain
              innerRef={inputRef}
              className="agm-field-text-input"
              inputId={ids.input}
              value={query}
              placeholder={placeholder}
              role="combobox"
              isExpanded={isListVisible}
              aria-controls={ids.listbox}
              aria-activedescendant={activeDescendant()}
              onChange={(_event, text) => onQueryChange(text)}
              onFocus={() => setIsFocused(true)}
              onBlur={onBlur}
              inputProps={{
                ...inputNameProps,
                "aria-autocomplete": "list",
                "aria-describedby": `${ids.hint} ${ids.instructions}`,
                autoComplete: "off",
                onKeyDown: keyboard.onKeyDown,
                onPaste,
              }}
            >
              {values.length > 0 && (
                <MultiSelectEntries
                  label={label}
                  nameId={ids.entriesName}
                  aria-labelledby={ariaLabelledBy}
                  labelPrefixedBy={labelPrefixedBy}
                  values={values}
                  layout={layout}
                  isKnown={isKnown}
                  toLabel={toLabel}
                  errorFor={errorFor}
                  activeStop={activeStop}
                  entryId={ids.entry}
                  onActivate={(index) => activateStop({ kind: "value", index })}
                  onRemove={removeValue}
                  maxEntryWidth={maxEntryWidth}
                  summary={
                    hasSummary
                      ? {
                          id: ids.summary,
                          hiddenCount: collapsedLayout.hiddenCount,
                          isExpanded: hasToggle ? showsEveryValue : undefined,
                          isActive: activeStop?.kind === "toggle",
                          onPress: hasToggle ? toggleSummary : () => inputRef.current?.focus(),
                        }
                      : undefined
                  }
                />
              )}
            </TextInputGroupMain>
            {hasClearAll && (
              <TextInputGroupUtilities>
                <Button
                  id={ids.clearAll}
                  variant="plain"
                  // Not a tab stop: the keyboard reaches it from the text box
                  // with the right arrow, so the field keeps a single one.
                  tabIndex={-1}
                  className={navigation.mode === "clearAll" ? "agm-field-focus-ring" : undefined}
                  // TRANSLATORS: accessible name of the button that empties a
                  // field holding several values.
                  aria-label={_("Clear all")}
                  icon={<Icon name="close" />}
                  onClick={clearAll}
                />
              </TextInputGroupUtilities>
            )}
          </TextInputGroup>
        </MenuToggle>
      </div>

      <MultiSelectOptionList
        triggerRef={controlRef}
        isOpen={isListVisible}
        rows={optionRows}
        listboxId={ids.listbox}
        aria-labelledby={labelId}
        rowId={ids.row}
        activeIndex={navigation.mode === "options" ? navigation.index : undefined}
        selected={values}
        onSelectRow={activateRow}
        footerEntry={footerEntry}
        noResultsText={
          showNoResults
            ? // TRANSLATORS: shown in place of the options when the text the
              // user typed leaves nothing to choose from.
              _("No options match")
            : undefined
        }
      />

      <FormHelperText>
        <HelperText>
          <ScreenReaderInstructions
            id={ids.instructions}
            sentences={focusHintSentences(hintContext)}
          />
          <SightedInstructions
            hasEntries={values.length > 0}
            isDirty={values.length > 0 || query !== ""}
          />
          <HelperTextItem id={ids.hint}>
            {helperText && <Text textStyle={["fontSizeSm", "textColorSubtle"]}>{helperText}</Text>}
          </HelperTextItem>
          {hasAnyError && (
            <HelperTextItem variant="error">
              {sift([...fieldErrors, ...entryErrors]).join(". ")}
            </HelperTextItem>
          )}
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );
}

export type { MultiSelectFieldProps, MultiSelectOption };
