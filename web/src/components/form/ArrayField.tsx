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
  Label,
  TextInputGroup,
  TextInputGroupMain,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Button,
} from "@patternfly/react-core";
import Text from "~/components/core/Text";
import Interpolate from "~/components/core/Interpolate";
import { useFieldContext } from "~/hooks/form-contexts";
import { _ } from "~/i18n";

/**
 * Keys owned by the entry navigation handler when an entry is active.
 *
 * Space is included alongside Enter to match the ARIA listbox pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/listbox/), where both keys
 * activate the focused option. Any key outside this set exits navigation
 * without consuming the event, so Tab moves focus away and regular characters
 * land in the draft input normally.
 */
const NAVIGATION_KEYS = new Set([
  " ",
  "ArrowLeft",
  "ArrowUp",
  "ArrowRight",
  "ArrowDown",
  "Home",
  "End",
  "Enter",
  "Delete",
  "Backspace",
]);

/** Applies `normalize` to `value` if provided; otherwise returns `value` unchanged. */
function normalizeValue(value: string, normalize?: (v: string) => string): string {
  return normalize ? normalize(value) : value;
}

/**
 * Trims, normalizes, and optionally validates a raw draft string.
 *
 * Returns `null` for empty or whitespace-only input so callers can skip
 * adding an empty entry. Otherwise returns the normalized value and any
 * validation error.
 */
function processDraft(
  raw: string,
  normalize?: (v: string) => string,
  validate?: (v: string) => string | undefined,
): { normalized: string; error: string | undefined } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = normalizeValue(trimmed, normalize);
  return { normalized, error: validate?.(normalized) };
}

/** Builds the screen-reader announcement for a multi-entry paste. Pure function. */
function pasteAnnouncement(
  added: number,
  skipped: number,
  valid: string[],
  invalid: string[],
): string {
  // TRANSLATORS: %d will be replaced with a number of duplicate entries skipped.
  if (added === 0) return sprintf(_("%d duplicates skipped."), skipped);

  if (skipped === 0) {
    return invalid.length === 0
      ? // TRANSLATORS: %d will be replaced with a number of added entries.
        sprintf(_("%d entries added."), valid.length)
      : // TRANSLATORS: first %d is the number of added entries, second %d is
        // the number of invalid entries.
        sprintf(_("%d entries added, %d invalid."), added, invalid.length);
  }

  if (invalid.length === 0)
    // TRANSLATORS: first %d is the number of added entries, second %d is the number of duplicate entries skipped.
    return sprintf(_("%d entries added, %d duplicates skipped."), valid.length, skipped);

  // TRANSLATORS: first %d is the number of added entries, second %d is the number of invalid entries, third %d is the number of duplicates skipped.
  return sprintf(
    _("%d entries added, %d invalid, %d duplicates skipped."),
    added,
    invalid.length,
    skipped,
  );
}

/** Splits pasted text on whitespace and commas, returning non-empty entries. */
function parsePasteEntries(text: string): string[] {
  return sift(text.split(/[\s,]+/).map((t) => t.trim()));
}

/**
 * Returns entries from `normalized` not already in `existing`,
 * also deduplicating within `normalized` itself.
 *
 * Prepends `existing` before deduplication so `unique` sees existing entries
 * first and drops any later occurrence of the same value. Slicing off the
 * first `existing.length` elements then yields only the genuinely new entries.
 */
function filterNew(existing: string[], normalized: string[]): string[] {
  return unique([...existing, ...normalized]).slice(existing.length);
}

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

type EntryProps = {
  /** Raw stored value, not necessarily the display form. */
  item: string;
  index: number;
  /** Whether this entry is currently focused during keyboard navigation. */
  isActive: boolean;
  /** Validation error message; undefined means the entry is valid. */
  error?: string;
  /** Formats the raw value for display and aria labels. */
  toLabel: (v: string) => string;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  /** Returns a stable DOM id used for aria-activedescendant. */
  valueId: (index: number) => string;
};

/**
 * A single committed entry, rendered as a listbox option.
 *
 * Both the visual color and the aria-label carry validation state, so
 * sighted and assistive-technology users receive the same information.
 */
function Entry({ item, index, isActive, error, toLabel, onEdit, onRemove, valueId }: EntryProps) {
  // preventDefault keeps focus on the input; the edit moves the value back to draft.
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onEdit(index);
  };

  // preventDefault avoids blur; stopPropagation prevents the span from triggering edit.
  const handleCloseMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(index);
  };

  const labelText = toLabel(item);

  return (
    <span style={{ cursor: "pointer" }} onMouseDown={handleMouseDown}>
      <Label
        id={valueId(index)}
        role="option"
        aria-selected={isActive}
        // TRANSLATORS: accessible label for an invalid entry. First %s is the entry value, second %s is the validation error.
        aria-label={error ? sprintf(_("%s is invalid: %s"), labelText, error) : labelText}
        color={error ? "red" : undefined}
        closeBtnProps={{
          tabIndex: -1,
          onMouseDown: handleCloseMouseDown,
        }}
        onClose={handleRemove}
        // TRANSLATORS: accessible label for the remove button of an entry. %s is the entry value.
        closeBtnAriaLabel={sprintf(_("Remove %s"), labelText)}
        style={{
          outline: isActive
            ? "2px solid var(--pf-v6-global--primary-color--100, #0066cc)"
            : undefined,
          outlineOffset: isActive ? 1 : undefined,
        }}
      >
        {labelText}
      </Label>
    </span>
  );
}

type MultiValueFieldProps = {
  /**
   * Label rendered by PatternFly's FormGroup.
   *
   * Can be a plain string or a ReactNode (e.g. `LabelText` with a suffix).
   * When a ReactNode is passed, also provide `inputAriaLabel` so assistive
   * technologies receive a plain-text version of the label.
   */
  label: React.ReactNode;

  /**
   * Plain-text label for assistive technologies.
   *
   * Used as the accessible name of the text input and as the base for the
   * listbox accessible name. Inferred from `label` when it is a plain string;
   * required when `label` is a ReactNode.
   */
  inputAriaLabel?: string;

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
   * Additional guidance shown alongside the error messages.
   *
   * Only rendered when the field has errors. Use to explain the expected
   * format or other context that helps the user fix invalid entries.
   */
  helperText?: React.ReactNode;

  /** Disables the text input and all entry interactions. */
  isDisabled?: boolean;
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
 * comma-separated string adds all tokens at once.
 *
 * Two validation modes are available:
 * - `validateOnChange`: runs on every commit; marks invalid entries right away.
 * - `validateOnSubmit`: runs only after TanStack Form sets a field-level error
 *   (i.e. after the first failed submit attempt); stays silent until then.
 *
 * Both sighted and assistive-technology users receive equivalent feedback:
 * invalid entries carry an aria-label describing the error; add, edit, and
 * remove actions are announced via a live region.
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
 * @todo Replace the component-local live region with a shared global one to
 *   avoid multiple `role="status"` elements on the same page.
 *
 * @see useFieldContext for field component conventions.
 */
export default function ArrayField({
  label,
  inputAriaLabel,
  helperText,
  isDisabled = false,
  validateOnChange,
  validateOnSubmit,
  normalize,
  displayValue,
  toDraft,
  skipDuplicates = false,
}: MultiValueFieldProps) {
  const field = useFieldContext<string[]>();
  const value = field.state.value;
  const onChange = (next: string[]) => field.handleChange(next);
  const fieldErrors = sift(field.state.meta.errors);
  const ariaLabel = inputAriaLabel ?? (typeof label === "string" ? label : undefined);

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
  const [announcement, setAnnouncement] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const toLabel = (item: string) => (displayValue ? displayValue(item) : item);
  const asDraft = (item: string) => (toDraft ? toDraft(item) : item);
  const valueId = (index: number) => `${field.name}-${index}`;
  const hintId = `${field.name}-hint`;
  const instructionsId = `${field.name}-instructions`;

  /**
   * TODO: Refactor announcements to use a shared global live region component
   * instead of this local hidden status element. This would allow multiple
   * components to share a single live region, simplifying DOM structure and
   * improving screen reader experience.
   *
   * - See Inclusive Components: https://inclusive-components.design/notifications/#live-regions
   * - Illustrative example of bad live region usage: "The Many Lives of Notifications"
   *   https://www.youtube.com/watch?v=W5YAaLLBKhQ&t=190s
   * - https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/
   * - https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-2/
   *
   * That future shared global live region should handle the edge case where the
   * same message is announced twice in a row — e.g. adding the same value twice
   * produces "alpha added." twice, or navigating away from an entry and back
   * announces it twice. Some screen readers suppress the second announcement
   * when the live region content has not changed between updates. The
   * documented fix is the clear-then-set pattern, but it adds complexity not
   * worth carrying in a temporary implementation.
   * https://dev.to/dkoppenhagen/when-your-live-region-isnt-live-fixing-aria-live-in-angular-react-and-vue-1g0j
   */
  const announce = (msg: string) => setAnnouncement(msg);

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
          announce(toLabel(value[value.length - 1]));
        }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const entries = parsePasteEntries(e.clipboardData.getData("text"));
    if (entries.length <= 1) return;
    e.preventDefault();

    const normalized = entries.map((t) => normalizeValue(t, normalize));
    const toAdd = skipDuplicates ? filterNew(value, normalized) : normalized;
    const [valid, invalid] = fork(toAdd, (n) => !validateOnChange?.(n));
    const skipped = normalized.length - toAdd.length;
    const added = toAdd.length;

    onChange([...value, ...toAdd]);
    setDraft("");
    clearActive();

    announce(pasteAnnouncement(added, skipped, valid, invalid));
  };

  const hasErrors = value.some(errorFor);
  const entryErrors = unique(sift(value.map(errorFor)));
  const hasAnyError = hasErrors || fieldErrors.length > 0;

  return (
    <FormGroup fieldId={field.name} label={label}>
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
              ...(ariaLabel && { "aria-label": ariaLabel }),
              onKeyDown,
              onPaste,
            }}
            style={{ flexBasis: "8rem", flexGrow: 1, display: "block" }}
          >
            {value.length > 0 && (
              <div
                role="listbox"
                // TRANSLATORS: accessible label for the entries list. %s is the
                // field label (e.g. "DNS servers").
                aria-label={ariaLabel ? sprintf(_("%s entries"), ariaLabel) : undefined}
                style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", padding: "0.2rem 0" }}
              >
                {value.map((item, index) => {
                  const error = errorFor(item);

                  return (
                    <Entry
                      key={index}
                      index={index}
                      item={item}
                      isActive={index === activeIndex}
                      error={error}
                      toLabel={toLabel}
                      onEdit={editAt}
                      onRemove={removeAt}
                      valueId={valueId}
                    />
                  );
                })}
              </div>
            )}
          </TextInputGroupMain>
        </TextInputGroup>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
        }}
      >
        {announcement}
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
