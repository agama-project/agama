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

/**
 * Everything a multi select field says to the user, in one place.
 *
 * Two kinds of text live here: what is announced when something happens, and
 * the hints that explain how to work the field. Both change with the field's
 * shape, so they are built from what the field was given rather than written
 * out at each place that needs them.
 */

import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

import type { TranslatedString } from "~/i18n";

/** A part of the field the keyboard can be on, and can be told about. */
type FieldPart = "options" | "entries" | "toggle" | "clearAll";

/** What the field is made of, which the hints follow. */
type HintContext = {
  /** Whether the field takes values that are not among its options. */
  allowCustomEntries: boolean;
  /** Whether any committed value is one the field offers. */
  hasKnownValues: boolean;
  /** Whether any committed value was typed in rather than chosen. */
  hasTypedValues: boolean;
  /** How many values are committed. */
  entriesCount: number;
};

/** Said when a value joins the field, invalid or not. */
export function valueAdded(label: string, error?: string): TranslatedString {
  if (error) {
    // TRANSLATORS: said after adding a value that does not pass validation.
    // First %s is the value, second %s is what is wrong with it.
    return sprintf(_("%s added but is invalid: %s. Select it to edit."), label, error);
  }
  // TRANSLATORS: said after a value joins the ones the field holds. %s is the
  // value.
  return sprintf(_("%s added."), label);
}

/** Said when the field already holds the value being added. */
export function valueAlreadySelected(label: string): TranslatedString {
  // TRANSLATORS: said when the field already holds the value the user is
  // adding, so nothing changes. %s is the value.
  return sprintf(_("%s is already selected."), label);
}

/** Said when the text names nothing the field offers, and it takes nothing else. */
export function valueNotAvailable(text: string): TranslatedString {
  // TRANSLATORS: said when the text the user typed names none of the values on
  // offer, and the field only takes those. %s is the text.
  return sprintf(_("%s is not available."), text);
}

/** Said when a value leaves the field. */
export function valueRemoved(label: string): TranslatedString {
  // TRANSLATORS: said after a value is taken out of the field. %s is the value.
  return sprintf(_("%s removed."), label);
}

/** Said when a value goes back into the text box to be edited. */
export function valueMovedToInput(label: string): TranslatedString {
  // TRANSLATORS: said when a value returns to the text box, where the user can
  // change it. %s is the value.
  return sprintf(_("%s moved to the text box for editing."), label);
}

/** Said when the list opens on a value the field holds. */
export function valueShownInList(label: string): TranslatedString {
  // TRANSLATORS: said when the list of options opens showing a value the field
  // already holds, so the user can take it back out. %s is the value.
  return sprintf(_("%s shown in the list of options."), label);
}

/** Said when every value is taken out at once. */
export function allValuesRemoved(): TranslatedString {
  // TRANSLATORS: said after a single press takes every value out of the field.
  return _("All values removed.");
}

/** Said when the field switches between showing every value and summarizing. */
export function overflowState(shownCount: number, totalCount: number): TranslatedString {
  if (shownCount >= totalCount) {
    // TRANSLATORS: said when the field starts showing every value it holds. %d
    // is how many there are.
    return sprintf(_("Showing all %d values."), totalCount);
  }
  // TRANSLATORS: said when the field shows only part of the values it holds,
  // and stands for the rest with a summary. First %d is how many are shown,
  // second %d is how many there are.
  return sprintf(_("Showing %d of %d values."), shownCount, totalCount);
}

/** Said once the user stops typing, so the outcome of the filter is heard. */
export function filterOutcome(count: number): TranslatedString {
  if (count === 0) {
    // TRANSLATORS: said when nothing in the list matches what the user typed.
    return _("No options match.");
  }
  // TRANSLATORS: said when the user stops typing, to tell how much is left in
  // the list. %d is how many options match.
  return sprintf(_("%d options available."), count);
}

/** Said after a paste brings in several values at once. */
export function pasteSummary(added: number, duplicates: number, refused: number): TranslatedString {
  if (duplicates === 0 && refused === 0) {
    // TRANSLATORS: said after pasting several values into the field. %d is how
    // many were added.
    return sprintf(_("%d values added."), added);
  }

  if (refused === 0) {
    // TRANSLATORS: said after pasting several values, some of which the field
    // already held. First %d is how many were added, second %d is how many
    // were already there.
    return sprintf(_("%d values added, %d already there."), added, duplicates);
  }

  if (duplicates === 0) {
    // TRANSLATORS: said after pasting several values, some of which the field
    // does not offer and does not take. First %d is how many were added,
    // second %d is how many were left out.
    return sprintf(_("%d values added, %d not available."), added, refused);
  }

  // TRANSLATORS: said after pasting several values, some already in the field
  // and some it does not offer. First %d is how many were added, second %d is
  // how many were already there, third %d is how many were left out.
  return sprintf(
    _("%d values added, %d already there, %d not available."),
    added,
    duplicates,
    refused,
  );
}

/**
 * The short instructions a screen reader reads when the field takes focus.
 *
 * One sentence per part of the field that is actually there, so a field
 * without values or without free entry says nothing about them. They are kept
 * apart rather than joined into one text, so each can be translated as the
 * whole sentence it is.
 */
export function focusHintSentences({
  allowCustomEntries,
  entriesCount,
}: HintContext): TranslatedString[] {
  const sentences: TranslatedString[] = [];

  if (allowCustomEntries) {
    // TRANSLATORS: read when a field taking several values gets focus, for a
    // field that also takes values the user writes out.
    sentences.push(_("Type to filter the options, or to write a value of your own."));
  } else {
    // TRANSLATORS: read when a field taking several values gets focus.
    sentences.push(_("Type to filter the options."));
  }

  // TRANSLATORS: read when a field taking several values gets focus, about the
  // key that shows what the field offers.
  sentences.push(_("Down arrow opens the list of options."));

  if (entriesCount > 0) {
    // TRANSLATORS: read when a field taking several values gets focus, about
    // reaching the values it already holds. %d is how many there are.
    sentences.push(sprintf(_("Left arrow reaches the %d values already added."), entriesCount));
  }

  return sentences;
}

/**
 * Joins what the field has just said with the hint that follows it.
 *
 * Both reach the user as a single announcement, so the hint adds to the news
 * instead of talking over it.
 */
export function withHint(
  said: TranslatedString | undefined,
  hint: TranslatedString,
): TranslatedString {
  if (!said) return hint;
  return `${said} ${hint}` as TranslatedString;
}

/** The visible hint under the field, shown once the user is working on it. */
export function sightedHint(hasEntries: boolean): TranslatedString {
  if (hasEntries) {
    // TRANSLATORS: keyboard hint shown under a field that already holds values.
    return _("Down arrow for options, Enter to add, Delete to remove, arrow keys to navigate");
  }
  // TRANSLATORS: keyboard hint shown under a field taking several values.
  return _("Down arrow for options, Enter to add");
}

/**
 * What a part of the field says the first time the keyboard reaches it.
 *
 * Said once per visit to the field: what the part holds is announced by the
 * field itself as the keyboard moves, and repeating how it works on every step
 * would talk over it.
 */
export function contextualHint(part: FieldPart, context: HintContext): TranslatedString {
  if (part === "options") {
    // TRANSLATORS: said the first time the keyboard reaches the list of options.
    return _("Enter selects or deselects an option, Escape closes the list.");
  }

  if (part === "toggle") {
    // TRANSLATORS: said the first time the keyboard reaches the summary
    // standing for the values the field does not show.
    return _("Enter shows or hides the remaining values.");
  }

  if (part === "clearAll") {
    // TRANSLATORS: said the first time the keyboard reaches the button that
    // empties the field.
    return _("Enter removes every value, Left arrow goes back to the text box.");
  }

  if (context.hasKnownValues && context.hasTypedValues) {
    // TRANSLATORS: said the first time the keyboard reaches the values a field
    // holds, when some were chosen from the list and some were written out.
    return _(
      "Enter shows a chosen value in the list or takes a written one back to the text box, Delete removes it, arrow keys move between values.",
    );
  }

  if (context.hasTypedValues) {
    // TRANSLATORS: said the first time the keyboard reaches the values a field
    // holds, when the user wrote them out rather than choosing them.
    return _(
      "Enter takes a value back to the text box, Delete removes it, arrow keys move between values.",
    );
  }

  // TRANSLATORS: said the first time the keyboard reaches the values a field
  // holds, when they come from its list of options.
  return _("Enter shows a value in the list, Delete removes it, arrow keys move between values.");
}

export type { FieldPart, HintContext };
