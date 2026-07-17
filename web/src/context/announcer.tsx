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

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { last } from "radashi";
import type { TranslatedString } from "~/i18n";

/**
 * How urgently a screen reader delivers the message.
 *
 * - "polite" waits for the screen reader to finish what it is currently
 *   reading. The right choice for almost every message.
 * - "assertive" interrupts the current speech. Reserve it for messages the
 *   user cannot afford to miss, such as a loss of data or context.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live
 */
type Politeness = "polite" | "assertive";

type AnnounceOptions = {
  /** Delivery urgency. Defaults to "polite". */
  politeness?: Politeness;
};

/**
 * What can be announced: a translated string, or a React element whose
 * rendered text is the message. An element is useful for reusing sentences
 * that carry visual markup, such as Interpolate output. The empty string
 * clears the regions. Plain untranslated strings are rejected on purpose.
 */
type Message = TranslatedString | "" | React.ReactElement;

/**
 * Sends a message to screen reader users. An empty message clears the region
 * without announcing anything.
 */
type Announce = (message: Message, options?: AnnounceOptions) => void;

const AnnouncerContext = createContext<Announce | undefined>(undefined);

/**
 * Registers an element as the portal target for the live regions. Returns the
 * function that undoes the registration.
 */
type RegisterTarget = (element: HTMLElement) => () => void;

const AnnouncerTargetContext = createContext<RegisterTarget | undefined>(undefined);

/**
 * Which of the two alternating live nodes holds the current message.
 */
type Slot = {
  active: 0 | 1;
  message: Message;
};

const emptySlot: Slot = { active: 0, message: "" };

/** Live-region content for each politeness level. */
type Slots = Record<Politeness, Slot>;

const emptySlots: Slots = { polite: emptySlot, assertive: emptySlot };

/** Switches to the other live-region node for the next message. */
const nextSlot = ({ active }: Slot, message: Message): Slot => ({
  active: active === 0 ? 1 : 0,
  message,
});

/**
 * Pair of alternating live-region nodes for one politeness level.
 *
 * Each message is written to the currently empty node while the other is
 * cleared. This forces a DOM change even when the message repeats, allowing
 * screen readers to announce identical consecutive messages.
 * https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-2/
 *
 * The nodes intentionally use only `aria-live`. Permanently mounted, empty
 * `role="status"` or `role="alert"` elements appear in screen reader element
 * lists and duplicate real page status or alert content.
 */
function LiveRegion({ politeness, slot }: { politeness: Politeness; slot: Slot }) {
  const messageFor = (index: Slot["active"]) => (slot.active === index ? slot.message : "");

  return (
    <>
      <div aria-live={politeness} aria-atomic="true">
        {messageFor(0)}
      </div>
      <div aria-live={politeness} aria-atomic="true">
        {messageFor(1)}
      </div>
    </>
  );
}

/**
 * Provides application-wide ARIA live regions and the {@link useAnnounce} hook.
 *
 * Mount once near the application root so the regions exist before any
 * announcement and survive route changes. Live regions added together with
 * their content are not announced reliably.
 *
 * The regions render through a portal (by default into `document.body`) to
 * avoid ancestor styles interfering with their visibility.
 *
 * While a modal dialog is open, live regions outside it are inaccessible to
 * assistive technology; {@link AnnouncerTarget} relocates the regions into the
 * dialog to keep announcements working.
 *
 * Announcements use last-wins semantics per politeness level: each new message
 * replaces any pending one instead of queueing behind it.
 *
 * @see https://www.w3.org/TR/wai-aria-1.2/#aria-live
 * @see https://inclusive-components.design/notifications/#live-regions
 */
function AnnouncerProvider({ children }: React.PropsWithChildren) {
  const [slots, setSlots] = useState<Slots>(emptySlots);
  const [targets, setTargets] = useState<HTMLElement[]>([]);

  // Stable identity prevents every announcement from re-rendering all context
  // consumers.
  const announce = useCallback<Announce>((message, options = {}) => {
    const { politeness = "polite" } = options;
    setSlots((current) => ({ ...current, [politeness]: nextSlot(current[politeness], message) }));
  }, []);

  // Relocating the live regions clears any pending announcement. Messages
  // moved together with a live region are stale and may not be announced.
  //
  // Stable identity prevents AnnouncerTarget from repeatedly unregistering
  // and registering itself in an endless render loop.
  const registerTarget = useCallback<RegisterTarget>((element) => {
    setTargets((current) => [...current, element]);
    setSlots(emptySlots);

    return () => {
      setTargets((current) => current.filter((target) => target !== element));
      setSlots(emptySlots);
    };
  }, []);

  const target = last(targets) ?? document.body;

  return (
    <AnnouncerContext.Provider value={announce}>
      <AnnouncerTargetContext.Provider value={registerTarget}>
        {children}
        {createPortal(
          <div className={a11yStyles.screenReader}>
            <LiveRegion politeness="polite" slot={slots.polite} />
            <LiveRegion politeness="assertive" slot={slots.assertive} />
          </div>,
          target,
        )}
      </AnnouncerTargetContext.Provider>
    </AnnouncerContext.Provider>
  );
}

/**
 * Relocation point for the application-wide live regions inside a modal
 * dialog.
 *
 * An open modal dialog cuts screen reader users off from the rest of the
 * page: the dialog carries `aria-modal` and its siblings receive
 * `aria-hidden`, so a live region outside the dialog stops being announced.
 * Mounting this component inside the dialog moves the regions within the
 * dialog boundary, and {@link useAnnounce} keeps working while the dialog
 * is open.
 *
 * It renders an empty element that registers itself as the portal target
 * for the regions. On unmount, the regions move back to the previous
 * location. When several targets are mounted at once, the most recent one
 * receives the announcements. That covers nested dialogs as a safety net
 * only: Agama neither uses nor encourages nesting dialogs.
 *
 * `Popup` already mounts one, so content rendered through `Popup` announces
 * without extra setup. Dialogs built directly on other modal primitives
 * need to mount their own.
 *
 * Without an {@link AnnouncerProvider} ancestor the component renders
 * nothing and has no effect.
 */
function AnnouncerTarget() {
  const registerTarget = useContext(AnnouncerTargetContext);
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (registerTarget && element) return registerTarget(element);
  }, [registerTarget, element]);

  if (!registerTarget) return null;

  return <div ref={setElement} />;
}

/**
 * Returns a function that announces messages through the application-wide
 * live regions.
 *
 * Use for feedback that is visible but produces neither sound nor a focus
 * change, such as updated result counts, added or removed items, or mode
 * changes.
 *
 * Callers inside a modal dialog need an {@link AnnouncerTarget}; `Popup`
 * already provides one.
 *
 * @example
 * const announce = useAnnounce();
 * // TRANSLATORS: screen reader announcement when an entry is removed. %s is the entry value.
 * announce(sprintf(_("%s removed."), label));
 *
 * @throws when no {@link AnnouncerProvider} is mounted above the caller.
 */
function useAnnounce(): Announce {
  const announce = useContext(AnnouncerContext);

  if (!announce) {
    throw new Error("useAnnounce needs an AnnouncerProvider ancestor");
  }

  return announce;
}

export { AnnouncerProvider, AnnouncerTarget, useAnnounce };
export type { AnnounceOptions };
