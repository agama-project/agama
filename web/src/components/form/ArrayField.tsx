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

import React, { useState, useRef } from "react";
import { fork, sift, unique } from "radashi";
import { sprintf } from "sprintf-js";
import {
  FormGroup,
  TextInputGroup,
  TextInputGroupMain,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Button,
} from "@patternfly/react-core";
import Text from "~/components/core/Text";
import Interpolate from "~/components/core/Interpolate";
import EntriesListbox from "~/components/form/primitives/EntriesListbox";
import FieldEntry from "~/components/form/primitives/FieldEntry";
import {
  filterNew,
  NAVIGATION_KEYS,
  normalizeValue,
  parsePasteEntries,
  pasteAnnouncement,
  processDraft,
} from "~/components/form/primitives/entry-helpers";
import { resolveAriaLabelProps, useFieldLabel } from "~/hooks/use-field-label";
import { useFieldContext } from "~/hooks/form-contexts";
import { useAnnounce } from "~/context/announcer";
import { _ } from "~/i18n";
import type { TranslatedString } from "~/i18n";

/**
 * Renders keyboard usage instructions for screen readers.
 *
 * Always rendered but visually hidden, accessed via aria-describedby.
 * Provides complete keyboard navigation instructions.
 */
function ScreenReaderInstructions({ id }: { id: string }) {
  return (
    <HelperTextItem id={id}>
      <Text srOnly>
        {
          // TRANSLATORS: keyboard usage hint for screen readers.
          _(
            "Enter or Tab to add, Backspace or Delete to remove, arrow keys to navigate entries, Escape to exit",
          )
        }
      </Text>
    </HelperTextItem>
  );
}

/**
 * Renders keyboard usage instructions for sighted users.
 *
 * Shows context-aware hints based on whether entries exist.
 * Only rendered when field is dirty (has entries or draft content).
 */
function SightedInstructions({ hasEntries, isDirty }: { hasEntries: boolean; isDirty: boolean }) {
  if (!isDirty) return null;

  return (
    <HelperTextItem>
      <Text textStyle={["fontSizeXs", "textColorSubtle"]}>
        {hasEntries
          ? // TRANSLATORS: keyboard usage hint when entries exist.
            _("Enter or Tab to add, Backspace or Delete to remove, arrow keys to navigate")
          : // TRANSLATORS: keyboard usage hint when field is empty.
            _("Enter or Tab to add")}
      </Text>
    </HelperTextItem>
  );
}

type ArrayFieldProps = {
  /**
   * Label rendered by PatternFly's FormGroup.
   *
   * Either a translated string (wrapped with `_()`) or a ReactNode (e.g.
   * `LabelText` with a suffix). Plain untranslated strings are rejected at the
   * type level. In both cases the input's accessible name comes from the
   * visible label via the FormGroup association.
   */
  label: TranslatedString | Exclude<React.ReactNode, string>;

  /**
   * Optional override for the input's accessible name.
   *
   * When omitted, the input is named by the visible label. Use only when the
   * label alone does not describe the input well enough.
   *
   * `labelPrefixedBy` and `aria-labelledby` take precedence.
   */
  inputAriaLabel?: TranslatedString;

  /**
   * One or more element IDs whose text replaces the field's own label in the
   * input's accessible name entirely, e.g. other on-screen elements that
   * already describe the field. Use only when those elements fully describe
   * the field; otherwise prefer `labelPrefixedBy`.
   *
   * Takes precedence over both `labelPrefixedBy` and `inputAriaLabel` for the
   * input's accessible name, and over `labelPrefixedBy` for the entries list
   * name as well, so both read consistently.
   *
   * @see useFieldLabel
   */
  "aria-labelledby"?: string;

  /**
   * One or more element IDs whose text prefixes the field's own label in the
   * input's accessible name, e.g. a parent fieldset legend. Use to disambiguate
   * fields that share a generic label without adding a new translatable string.
   *
   * Takes precedence over `inputAriaLabel` for the input's accessible name, and
   * is prepended to the entries list name as well, so both read consistently.
   *
   * @see useFieldLabel
   */
  labelPrefixedBy?: string;

  /**
   * Per-entry validator that runs on every commit.
   *
   * Invalid entries are marked and announced immediately, before the form is
   * submitted. Use for format checks that are always safe to run eagerly,
   * such as address or URL format.
   */
  validateOnChange?: (value: string) => string | undefined;

  /**
   * Per-entry validator that runs only after the first failed form submit.
   *
   * Stays silent until TanStack Form sets a field-level error on this field.
   * Use for checks that would be distracting before the user attempts to
   * submit, such as cross-field or server-validated rules.
   */
  validateOnSubmit?: (value: string) => string | undefined;

  /**
   * Normalizes user input before it is committed.
   *
   * Runs on every added entry, including pasted ones. Use for trimming,
   * casing, or any formatting rule applied at commit time.
   */
  normalize?: (value: string) => string;

  /**
   * Formats a stored value for display and accessible labels.
   *
   * When omitted, the stored value is used as-is. Useful when the stored
   * form differs from the human-readable form, e.g. a code vs. a name.
   */
  displayValue?: (value: string) => string;

  /**
   * Converts a stored value back to a draft string for editing.
   *
   * Called when an entry is moved into the text input for modification.
   * When omitted, the stored value is used as-is.
   */
  toDraft?: (value: string) => string;

  /**
   * When true, skips entries that are already in the list.
   *
   * Applies to both single commits and multi-token pastes.
   */
  skipDuplicates?: boolean;

  /**
   * Pattern used to split pasted text into individual entries.
   *
   * Defaults to whitespace and commas, which works for most use cases
   * (IP addresses, hostnames, emails, etc.). Override when entries
   * themselves contain spaces — for example, pass `"\n"` for SSH public
   * keys, which are one-per-line.
   *
   * Blank entries are always filtered out after splitting regardless of
   * the pattern used.
   */
  splitPasteOn?: RegExp | string;

  /**
   * Additional guidance shown alongside the error messages.
   *
   * Only rendered when the field has errors. Use to explain the expected
   * format or other context that helps the user fix invalid entries.
   */
  helperText?: React.ReactNode;

  /** Disables the text input and all entry interactions. */
  isDisabled?: boolean;

  /**
   * Maximum width for entries in "ch" units.
   *
   * When set, entries exceeding this width are truncated in the middle.
   * When undefined, no truncation is applied.
   */
  maxEntryWidth?: number;
};

/**
 * A form field for entering and managing a list of string values.
 *
 * Users type in a text input and commit entries one at a time via Enter,
 * Tab, or blur. Each committed entry appears as a labeled token inside the
 * field. Entries can be edited by clicking them or selecting them with the
 * keyboard, and removed individually via the close button or Backspace/Delete.
 * A clear-invalid button removes all invalid entries at once when any are present.
 *
 * Keyboard navigation follows the ARIA listbox pattern: ArrowLeft/Right/Up/Down
 * move between entries, Enter and Space activate the focused one, Home/End jump
 * to the first or last, and Escape exits navigation. Pasting a whitespace- or
 * comma-separated string adds all tokens at once. The splitting pattern can be
 * customized via `splitPasteOn` (e.g., `"\n"` for newline-separated entries).
 *
 * The component correctly handles newline splitting because the paste event
 * handler reads from `clipboardData.getData('text')` before the browser
 * sanitizes the value. Text inputs strip newlines per HTML spec when assigning
 * to `.value`, but the paste event provides raw clipboard data. See
 * `parsePasteEntries` unit tests for verification of the splitting logic.
 * Reference: https://html.spec.whatwg.org/multipage/input.html#text-(type=text)-state-and-search-state-(type=search)
 *
 * Two validation modes are available:
 * - `validateOnChange`: runs on every commit; marks invalid entries right away.
 * - `validateOnSubmit`: runs only after TanStack Form sets a field-level error
 *   (i.e. after the first failed submit attempt); stays silent until then.
 *
 * Both sighted and assistive-technology users receive equivalent feedback:
 * invalid entries carry an aria-label describing the error; add, edit, and
 * remove actions are announced via the application-wide live region (see
 * {@link useAnnounce}).
 *
 * Must be used inside a TanStack Form `AppField` context that provides a
 * `string[]` field value.
 *
 * @remarks
 * **Keyboard focus model**
 *
 * This component uses `aria-activedescendant` instead of roving tabIndex.
 *
 * The MDN guide on keyboard-navigable widgets
 * (https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets)
 * describes two approaches: roving tabIndex (move DOM focus between elements)
 * and `aria-activedescendant` (keep DOM focus on one element and point to the
 * active descendant by id).
 *
 * Roving tabIndex was tried first but did not work reliably here. When an
 * `onClick` prop is passed to PatternFly's `Label` component, PF renders the
 * label content inside a `<button>`, which adds an extra tab stop and
 * interferes with focus management. Focus would jump into the button's
 * internals rather than land on the entry element as expected.
 *
 * The fix was to not pass `onClick` to `Label` at all and instead handle
 * pointer interaction via `onMouseDown` + `preventDefault()` on a wrapper
 * `<span>`. With that, entries are rendered as plain non-focusable elements
 * inside a `role="listbox"` container, the `<input>` always holds real DOM
 * focus, and the active entry is communicated to assistive technology via
 * `aria-activedescendant` on the input pointing to the entry's id. Keyboard
 * navigation updates `aria-activedescendant` without touching DOM focus.
 *
 * @todo Support a layout option where entries render one per line, for use
 *   cases with long values such as SSH public keys.
 * @todo Rework the layout so entries sit above the input row, with a visual
 *   separator and the usage hint inline next to the input.
 * @todo Add clipboard copy support; today only paste is intercepted.
 *
 * @see useFieldContext for field component conventions.
 */
export default function ArrayField({
  label,
  inputAriaLabel,
  "aria-labelledby": ariaLabelledBy,
  labelPrefixedBy,
  helperText,
  isDisabled = false,
  validateOnChange,
  validateOnSubmit,
  normalize,
  displayValue,
  toDraft,
  skipDuplicates = false,
  splitPasteOn,
  maxEntryWidth,
}: ArrayFieldProps) {
  const field = useFieldContext<string[]>();
  const value = field.state.value;
  const onChange = (next: string[]) => field.handleChange(next);
  const fieldErrors = sift(field.state.meta.errors);
  // Names the text input: the visible label by default (self-referenced, since
  // PatternFly's TextInputGroupMain would otherwise inject its own default
  // aria-label), `inputAriaLabel` when given, or a contextual name that
  // prepends `labelPrefixedBy` (which takes precedence over `inputAriaLabel`);
  // an explicit `aria-labelledby` replaces it entirely and wins over all.
  const { labelId, labelProps } = useFieldLabel(field.name, {
    "aria-label": inputAriaLabel,
    "aria-labelledby": ariaLabelledBy,
    labelPrefixedBy,
  });
  const inputNameProps = resolveAriaLabelProps(labelProps, { "aria-labelledby": labelId });

  // Names the entries list, symmetric with the input: see EntriesListbox.
  const listboxNameId = `${field.name}-listbox-name`;

  /**
   * Returns the validation error for an entry, combining both validators.
   *
   * `validateOnChange` always runs. `validateOnSubmit` only runs once the
   * field has a TanStack Form error, so it stays silent until the first
   * failed submit attempt.
   */
  const errorFor = (item: string): string | undefined =>
    validateOnChange?.(item) || (fieldErrors.length > 0 ? validateOnSubmit?.(item) : undefined);

  const [draft, setDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const announce = useAnnounce();

  const inputRef = useRef<HTMLInputElement>(null);

  const toLabel = (item: string) => (displayValue ? displayValue(item) : item);
  const asDraft = (item: string) => (toDraft ? toDraft(item) : item);
  const valueId = (index: number) => `${field.name}-${index}`;
  const hintId = `${field.name}-hint`;
  const instructionsId = `${field.name}-instructions`;

  const clearActive = () => setActiveIndex(-1);

  const commit = (raw: string) => {
    const result = processDraft(raw, normalize, validateOnChange);
    if (!result) return;
    const { normalized, error } = result;

    if (skipDuplicates && value.includes(normalized)) {
      setDraft("");
      // TRANSLATORS: screen reader announcement when a duplicate entry is skipped. %s is the entry value.
      announce(sprintf(_("%s already exists, skipped."), toLabel(normalized)));
      return;
    }

    onChange([...value, normalized]);
    setDraft("");
    clearActive();
    announce(
      error
        ? // TRANSLATORS: screen reader announcement when an invalid entry is
          // added. First %s is the entry value, second %s is the validation error.
          sprintf(_("%s added but is invalid: %s. Select to edit."), normalized, error)
        : // TRANSLATORS: screen reader announcement when an entry is added. %s
          // is the entry value.
          sprintf(_("%s added."), normalized),
    );
  };

  const removeAt = (index: number) => {
    const item = value[index];
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
    // TRANSLATORS: screen reader announcement when an entry is removed. %s is
    // the entry value.
    announce(sprintf(_("%s removed."), toLabel(item)));

    if (newValue.length === 0) clearActive();
    else if (index >= newValue.length) setActiveIndex(newValue.length - 1);
  };

  const editAt = (index: number) => {
    const item = value[index];
    const pending = processDraft(draft, normalize, validateOnChange);
    const remaining = value.filter((_, i) => i !== index);
    onChange(pending ? [...remaining, pending.normalized] : remaining);
    setDraft(asDraft(item));
    clearActive();
    // TRANSLATORS: screen reader announcement when an entry is moved to the
    // input for editing. %s is the entry value.
    announce(sprintf(_("%s moved to input for editing."), toLabel(item)));
    inputRef.current?.focus();
  };

  const clearInvalid = () => {
    const [valid, invalid] = fork(value, (v) => !errorFor(v));
    onChange(valid);
    clearActive();
    // TRANSLATORS: screen reader announcement when all invalid entries are
    // cleared. %d is the number of removed entries.
    announce(sprintf(_("%d invalid entries removed."), invalid.length));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const navigating = activeIndex >= 0;

    if (navigating) {
      if (!NAVIGATION_KEYS.has(e.key)) {
        // Tab, Escape, or any other key: exit navigation without consuming the
        // event. Tab keeps its default so focus can move away. Regular
        // characters land in the draft.
        clearActive();
        return;
      }

      e.preventDefault();

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          if (activeIndex > 0) setActiveIndex((i) => i - 1);
          break;
        case "ArrowRight":
        case "ArrowDown":
          if (activeIndex < value.length - 1) setActiveIndex((i) => i + 1);
          else clearActive();
          break;
        case "Home":
          setActiveIndex(0);
          break;
        case "End":
          setActiveIndex(value.length - 1);
          break;
        case "Enter":
        case " ":
          editAt(activeIndex);
          break;
        case "Delete":
        case "Backspace":
          if (errorFor(value[activeIndex])) editAt(activeIndex);
          else removeAt(activeIndex);
          break;
      }
      return;
    }

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        commit(draft);
        return;
      case "Tab":
        if (draft.trim()) {
          e.preventDefault();
          commit(draft);
        }
        return;
      case "ArrowLeft":
      case "Backspace":
        if (draft === "" && value.length > 0) {
          e.preventDefault();
          setActiveIndex(value.length - 1);
          // The announced text is the entry value itself, the user input.
          // Consider it "translated"
          announce(toLabel(value[value.length - 1]) as TranslatedString);
        }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const entries = parsePasteEntries(e.clipboardData.getData("text"), splitPasteOn);
    if (entries.length <= 1) return;
    e.preventDefault();

    const normalized = entries.map((t) => normalizeValue(t, normalize));
    const toAdd = skipDuplicates ? filterNew(value, normalized) : normalized;
    const invalid = toAdd.filter((n) => validateOnChange?.(n));
    const skipped = normalized.length - toAdd.length;
    const added = toAdd.length;

    onChange([...value, ...toAdd]);
    setDraft("");
    clearActive();

    announce(pasteAnnouncement(added, skipped, { count: invalid.length, kind: "invalid" }));
  };

  const hasErrors = value?.some(errorFor);
  const entryErrors = unique(sift(value?.map(errorFor)));
  const hasAnyError = hasErrors || fieldErrors?.length > 0;

  return (
    <FormGroup fieldId={field.name} label={<span id={labelId}>{label}</span>}>
      <div onClick={() => inputRef.current?.focus()}>
        <TextInputGroup
          isDisabled={isDisabled}
          className={(hasAnyError && "pf-m-error") || undefined}
        >
          <TextInputGroupMain
            innerRef={inputRef}
            value={draft}
            aria-activedescendant={activeIndex >= 0 ? valueId(activeIndex) : undefined}
            onChange={(_, v) => {
              setDraft(v);
              clearActive();
            }}
            onBlur={() => {
              if (draft.trim()) commit(draft);
            }}
            inputProps={{
              id: field.name,
              "aria-describedby": `${hintId} ${instructionsId}`,
              ...inputNameProps,
              onKeyDown,
              onPaste,
            }}
            style={{ flexBasis: "8rem", flexGrow: 1, display: "block" }}
          >
            {value.length > 0 && (
              <EntriesListbox
                label={label}
                nameId={listboxNameId}
                aria-labelledby={ariaLabelledBy}
                labelPrefixedBy={labelPrefixedBy}
              >
                {value.map((item, index) => {
                  const error = errorFor(item);

                  return (
                    <FieldEntry
                      key={index}
                      index={index}
                      item={item}
                      isActive={index === activeIndex}
                      error={error}
                      toLabel={toLabel}
                      onEdit={editAt}
                      onRemove={removeAt}
                      valueId={valueId}
                      maxWidth={maxEntryWidth}
                    />
                  );
                })}
              </EntriesListbox>
            )}
          </TextInputGroupMain>
        </TextInputGroup>
      </div>

      <FormHelperText>
        <HelperText>
          <ScreenReaderInstructions id={instructionsId} />
          <SightedInstructions
            hasEntries={value.length > 0}
            isDirty={value.length > 0 || draft !== ""}
          />
          <HelperTextItem id={hintId}>
            {helperText && <Text textStyle={["fontSizeSm", "textColorSubtle"]}>{helperText}</Text>}
          </HelperTextItem>
          {hasAnyError && (
            <HelperTextItem variant="error">
              {!hasErrors && fieldErrors.join(". ")}
              {hasErrors && (
                <>
                  {entryErrors.join(". ")}.{" "}
                  <Interpolate
                    // TRANSLATORS: helper text for when there are invalid
                    // entries. Text inside square brackets [] becomes a button,
                    // keep the brackets.
                    sentence={_(
                      "Select entries to edit or remove them. Or [remove all invalid entries.]",
                    )}
                  >
                    {(text) => (
                      <Button variant="link" isInline onClick={clearInvalid}>
                        {text}
                      </Button>
                    )}
                  </Interpolate>
                </>
              )}
            </HelperTextItem>
          )}
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );
}
