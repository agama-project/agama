/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Icon } from "~/components/layout";
import { InstallerKeymapSwitcher, InstallerLocaleSwitcher } from "~/components/l10n";
import {
  About,
  Disclosure,
  // FIXME: unify names here by renaming LogsButton -> LogButton or ShowLogButton -> ShowLogsButton
  LogsButton,
  ShowLogButton,
  ShowTerminalButton,
} from "~/components/core";
import { noop } from "~/utils";
import { _ } from "~/i18n";
import useNodeSiblings from "~/hooks/useNodeSiblings";

/**
 * The Agama sidebar.
 * @component
 *
 * A component intended for placing things exclusively related to Agama.
 *
 * @typedef {object} SidebarProps
 * @property {boolean} [isOpen] - Whether the sidebar is open or not.
 * @property {() => void} [onClose] - A callback to be called when sidebar is closed.
 * @property {React.ReactNode} [props.children]
 *
 * @param {SidebarProps}
 */
export default function Sidebar ({ isOpen, onClose = noop, children }) {
  const asideRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [addAttribute, removeAttribute] = useNodeSiblings(asideRef.current);

  /**
   * Set siblings as not interactive and not discoverable.
   */
  const makeSiblingsInert = useCallback(() => {
    addAttribute('inert', '');
    addAttribute('aria-hidden', true);
  }, [addAttribute]);

  /**
   * Set siblings as interactive and discoverable.
   */
  const makeSiblingsAlive = useCallback(() => {
    removeAttribute('inert');
    removeAttribute('aria-hidden');
  }, [removeAttribute]);

  /**
   * Triggers the onClose callback.
   */
  const close = () => {
    onClose();
  };

  /**
   * Handler for automatically triggering the close function when a click bubbles from a
   * sidebar children.
   *
   * @param {MouseEvent} event
   */
  const onClick = (event) => {
    const target = event.detail?.originalTarget || event.target;
    const isLinkOrButton = target instanceof HTMLAnchorElement || target instanceof HTMLButtonElement;
    const keepOpen = target.dataset.keepSidebarOpen;

    if (!isLinkOrButton || keepOpen) return;

    close();
  };

  useEffect(() => {
    makeSiblingsInert();
    if (isOpen) {
      closeButtonRef.current.focus();
      makeSiblingsInert();
    } else {
      makeSiblingsAlive();
    }
  }, [isOpen, makeSiblingsInert, makeSiblingsAlive]);

  useLayoutEffect(() => {
    // Ensure siblings do not remain inert when the component is unmounted.
    // Using useLayoutEffect over useEffect for allowing the cleanup function to
    // be executed immediately BEFORE unmounting the component and still having
    // access to siblings.
    return () => makeSiblingsAlive();
  }, [makeSiblingsAlive]);

  return (
    <aside
      id="global-options"
      ref={asideRef}
      aria-label={_("Installer Options")}
      data-type="agama/sidebar"
      data-layout="agama/base"
      data-state={isOpen ? "visible" : "hidden"}
    >
      <header className="split justify-between">
        <h2>
          {/* TRANSLATORS: sidebar header */}
          {_("Installer Options")}
        </h2>

        <button
          onClick={close}
          ref={closeButtonRef}
          className="plain-control"
          aria-label={_("Hide installer options")}
        >
          <Icon name="menu_open" data-variant="flip-X" onClick={close} />
        </button>
      </header>

      <div className="flex-stack justify-between" onClick={onClick}>
        <div className="flex-stack">
          <Disclosure label={_("Diagnostic tools")} data-keep-sidebar-open>
            <ShowLogButton />
            <LogsButton data-keep-sidebar-open="true" />
            <ShowTerminalButton />
          </Disclosure>
          {children}
          <About />
        </div>
        <div className="full-width highlighted">
          <div className="flex-stack">
            <div className="locale-container">
              <div><InstallerLocaleSwitcher /></div>
              <div><InstallerKeymapSwitcher /></div>
            </div>
          </div>
        </div>
      </div>

      <footer className="split justify-between" data-state="reversed">
        <a onClick={close}>
          {/* TRANSLATORS: button label */}
          {_("Close")}
          <Icon name="menu_open" size="xxs" data-variant="flip-X" />
        </a>
      </footer>
    </aside>
  );
}
