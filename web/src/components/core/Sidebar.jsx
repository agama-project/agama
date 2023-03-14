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

import React, { useEffect, useRef, useState } from "react";
import { Icon, PageActions } from "~/components/layout";

/**
 * D-Installer sidebar navigation
 */
export default function Sidebar({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef(null);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  /**
   * Handler for automatically closing the sidebar when a click bubbles from a
   * children of its content.
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
    if (isOpen) closeButtonRef.current.focus();
  }, [isOpen]);

  return (
    <>
      <PageActions>
        <button
          onClick={open}
          className="plain-control"
          aria-label="Show navigation and other options"
          aria-controls="navigation-and-options"
          aria-expanded={isOpen}
        >
          <Icon name="menu" />
        </button>
      </PageActions>

      <nav
        id="navigation-and-options"
        className="wrapper sidebar"
        aria-label="Navigation and other options"
        data-state={isOpen ? "visible" : "hidden"}
      >
        <header className="split justify-between">
          <h2>Options</h2>

          <button
            onClick={close}
            ref={closeButtonRef}
            className="plain-control"
            aria-label="Hide navigation and other options"
          >
            <Icon name="menu_open" data-variant="flip-X" onClick={close} />
          </button>
        </header>

        <div className="flex-stack" onClick={onClick}>
          { children }
        </div>

        <footer className="split" data-state="reversed">
          <a onClick={close}>
            Close <Icon size="16" name="menu_open" data-variant="flip-X" />
          </a>
        </footer>
      </nav>
    </>
  );
}
