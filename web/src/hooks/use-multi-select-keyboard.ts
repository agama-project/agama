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

import React, { useEffect, useState } from "react";
import { NAVIGATION_KEYS } from "~/components/form/entry-helpers";

import type { EntryStop, OptionRow } from "~/components/form/multi-select-rows";

/**
 * Where the keyboard currently is.
 *
 * The field has three places to be, and it is in one of them at a time:
 * walking the open list, walking the committed values, or sitting on the
 * button that clears everything. `idle` is the rest of the time, when keys
 * type text; the list may well be open and showing, just with nothing picked
 * out in it.
 */
type Navigation =
  | { mode: "idle" }
  | { mode: "options"; index: number }
  | { mode: "entries"; index: number }
  | { mode: "clearAll" };

/**
 * What the field does when a key asks for it. None of these decide where the
 * keyboard goes next: that is this hook's job.
 */
type MultiSelectKeyboardActions = {
  /** Shows the list. */
  openList: () => void;
  /** Hides the list, leaving the text alone. */
  closeList: () => void;
  /**
   * Commits what the input holds, and answers whether anything was committed.
   * A blank input, or a value the field cannot accept, commits nothing.
   */
  commitText: () => boolean;
  /** Selects or deselects an option, commits the text, or leaves for elsewhere. */
  activateRow: (row: OptionRow) => void;
  /**
   * Adds what a row offers, leaving a value the field already holds alone.
   * Tab confirms a choice; it is not a way to undo one.
   */
  commitRow: (row: OptionRow) => void;
  /** Edits a typed in value, finds a known one in the list, or flips the summary. */
  activateStop: (stop: EntryStop) => void;
  /** Removes the value at a stop. The summary toggle has nothing to remove. */
  removeStop: (stop: EntryStop) => void;
  /** Clears the text the user typed, leaving the committed values. */
  clearText: () => void;
  /** Removes every value and the text. */
  clearAll: () => void;
};

type MultiSelectKeyboardInput = {
  /** Rows of the list, in the order they are shown. */
  optionRows: OptionRow[];
  /** Stops among the committed values, in the order they are reached. */
  entryStops: EntryStop[];
  /** Whether the list is on screen. */
  isListOpen: boolean;
  /** Whether the button clearing everything is on screen. */
  hasClearAll: boolean;
  /** Whether the input holds anything other than blanks. */
  hasText: boolean;
  /** Whether a Tab that commits keeps focus in the field. */
  tabKeepsFocus: boolean;
  actions: MultiSelectKeyboardActions;
};

type MultiSelectKeyboard = {
  /** Where the keyboard is. Drives the highlight and `aria-activedescendant`. */
  navigation: Navigation;
  /** Handles a key pressed on the input. */
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Goes back to typing, picking nothing out. */
  reset: () => void;
  /** Picks out a row of the list, for a field opening it on a known value. */
  highlightRow: (index: number) => void;
  /** Picks out a stop, for a field whose values have just been laid out anew. */
  highlightStop: (index: number) => void;
  /** Steps into the committed values, on the last stop. */
  enterEntries: () => void;
};

const IDLE: Navigation = { mode: "idle" };

/** Moves `index` by one within `count` positions, coming back around at both ends. */
function wrap(index: number, count: number, step: number): number {
  return (index + step + count) % count;
}

/**
 * The keyboard of a field that commits several values, as a small state
 * machine over the positions the field offers.
 *
 * ## The contract
 *
 * Real focus stays in the text input the whole time. What moves is the
 * position this hook holds, which the field turns into a highlight and into
 * `aria-activedescendant`. Since that attribute can point at one thing only,
 * the position is in one mode at a time, and entering a mode leaves the
 * previous one.
 *
 * The hook decides where the keyboard goes; it never changes the field value,
 * and the caller never changes the position. Everything a key has to do to
 * the field happens through `actions`, which the caller provides.
 *
 * A key the current mode does not claim is left alone, so it reaches the
 * input: characters type, and Tab moves focus on rather than being swallowed
 * by a field the user cannot see their way out of.
 *
 * ## Where the keys go
 *
 * While typing: Down and Up open the list and pick out its first or last row;
 * Enter commits the text; Left and Backspace on an empty input step into the
 * committed values; Right with the caret at the end reaches the button that
 * clears everything; Escape closes the list, or clears the text when the list
 * is already closed.
 *
 * In the list: Down and Up move and come back around, Home and End jump to
 * the ends, Enter runs the row. Space is left to the input, which owns typing.
 *
 * Among the values: the arrows move either way, Home and End jump to the ends,
 * Enter and Space run the stop, Delete and Backspace remove it. Moving past
 * the last stop returns to the input. After a removal the keyboard holds its
 * place, which is now whatever took it, or the last stop when there is nothing
 * after it. A stop that lays the values out anew, such as the summary, takes
 * the keyboard with it through `highlightStop`.
 *
 * Tab commits the picked out row, or the text, and then keeps focus only if
 * something was committed and the field asks for it. It only ever adds: a
 * value the field already holds is left where it is, since Tab confirms a
 * choice rather than undoing one. An entry that leads somewhere else is not
 * something to commit, so Tab moves on instead of following it.
 */
export function useMultiSelectKeyboard({
  optionRows,
  entryStops,
  isListOpen,
  hasClearAll,
  hasText,
  tabKeepsFocus,
  actions,
}: MultiSelectKeyboardInput): MultiSelectKeyboard {
  const [navigation, setNavigation] = useState<Navigation>(IDLE);

  const reset = () => setNavigation(IDLE);
  const highlightRow = (index: number) => setNavigation({ mode: "options", index });
  const highlightStop = (index: number) => setNavigation({ mode: "entries", index });
  const enterEntries = () => {
    if (entryStops.length === 0) return;
    setNavigation({ mode: "entries", index: entryStops.length - 1 });
  };

  // Removing a value takes a stop away from under the keyboard. It stays where
  // it is, which is now whatever moved into that place, and falls back to the
  // last stop when it was the last one that went.
  useEffect(() => {
    if (navigation.mode !== "entries") return;
    if (navigation.index < entryStops.length) return;
    if (entryStops.length === 0) setNavigation(IDLE);
    else setNavigation({ mode: "entries", index: entryStops.length - 1 });
  }, [entryStops.length, navigation]);

  const openAt = (position: "first" | "last") => {
    if (optionRows.length === 0) return;
    actions.openList();
    setNavigation({
      mode: "options",
      index: position === "first" ? 0 : optionRows.length - 1,
    });
  };

  const moveInList = (step: number) => {
    const count = optionRows.length;
    if (count === 0) return;

    // With nothing picked out yet, the list is entered from its near end, the
    // way it is entered when the key also opens it.
    if (navigation.mode !== "options") {
      setNavigation({ mode: "options", index: step > 0 ? 0 : count - 1 });
      return;
    }

    setNavigation({ mode: "options", index: wrap(navigation.index, count, step) });
  };

  const moveInEntries = (step: number) => {
    if (navigation.mode !== "entries") return;
    const index = navigation.index + step;
    if (index < 0) return;
    if (index >= entryStops.length) reset();
    else setNavigation({ mode: "entries", index });
  };

  /**
   * Commits whatever Tab should commit and answers whether focus stays. A
   * picked out option goes first, the text second, and an entry leading
   * elsewhere is left for Enter.
   */
  const commitOnTab = (): boolean => {
    if (navigation.mode === "options") {
      const row = optionRows[navigation.index];
      if (row && row.kind !== "footer") {
        actions.commitRow(row);
        return true;
      }
    }
    return hasText && actions.commitText();
  };

  const onEntriesKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Anything this mode does not claim steps out of it and is left alone, so
    // Tab moves focus away and characters land in the input.
    if (!NAVIGATION_KEYS.has(event.key)) {
      reset();
      return;
    }

    const stop = entryStops[index];
    if (!stop) {
      reset();
      return;
    }

    event.preventDefault();

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        moveInEntries(-1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        moveInEntries(1);
        break;
      case "Home":
        setNavigation({ mode: "entries", index: 0 });
        break;
      case "End":
        setNavigation({ mode: "entries", index: entryStops.length - 1 });
        break;
      case "Enter":
      case " ":
        actions.activateStop(stop);
        break;
      case "Delete":
      case "Backspace":
        actions.removeStop(stop);
        break;
    }
  };

  const onClearAllKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      actions.clearAll();
      reset();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "Escape") {
      event.preventDefault();
      reset();
      return;
    }

    reset();
  };

  const onTypingKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const isCaretAtEnd = input.selectionStart === input.value.length;
    const isInputEmpty = input.value === "";

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (isListOpen) moveInList(1);
        else openAt("first");
        break;
      case "ArrowUp":
        event.preventDefault();
        if (isListOpen) moveInList(-1);
        else openAt("last");
        break;
      case "Home":
      case "End":
        if (navigation.mode !== "options") break;
        event.preventDefault();
        setNavigation({
          mode: "options",
          index: event.key === "Home" ? 0 : optionRows.length - 1,
        });
        break;
      case "Enter": {
        event.preventDefault();
        const row = navigation.mode === "options" ? optionRows[navigation.index] : undefined;
        if (row) actions.activateRow(row);
        else actions.commitText();
        break;
      }
      case "Escape":
        // Stopped here so the surrounding menu does not also act on it.
        event.stopPropagation();
        event.preventDefault();
        reset();
        if (isListOpen) actions.closeList();
        else actions.clearText();
        break;
      case "ArrowLeft":
      case "Backspace":
        if (!isInputEmpty || entryStops.length === 0) break;
        event.preventDefault();
        actions.closeList();
        enterEntries();
        break;
      case "ArrowRight":
        if (isListOpen || !hasClearAll || !isCaretAtEnd) break;
        event.preventDefault();
        setNavigation({ mode: "clearAll" });
        break;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Tab") {
      const committed = commitOnTab();
      // No preventDefault unless focus is meant to stay: a field nobody can
      // Tab out of is a trap.
      if (committed && tabKeepsFocus) event.preventDefault();
      else actions.closeList();
      reset();
      return;
    }

    if (navigation.mode === "entries") {
      onEntriesKeyDown(event, navigation.index);
      return;
    }

    if (navigation.mode === "clearAll") {
      onClearAllKeyDown(event);
      return;
    }

    onTypingKeyDown(event);
  };

  return { navigation, onKeyDown, reset, highlightRow, highlightStop, enterEntries };
}

export type { MultiSelectKeyboard, MultiSelectKeyboardActions, Navigation };
