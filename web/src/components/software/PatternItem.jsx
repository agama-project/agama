/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useEffect, useState } from "react";
import { sprintf } from "sprintf-js";

import cockpit from "../../lib/cockpit";

import { useInstallerClient } from "~/context/installer";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";

import iconAvailable from "./icons/package-available.svg";
import iconInstall from "./icons/package-install.svg";
import iconAutoInstall from "./icons/package-install-auto.svg";

// path to pattern icons, %s is replaced by the icon name
const ICON_PATH = "/usr/share/icons/hicolor/scalable/apps/%s.svg";

/**
 * Get checkbox status icon for the required pattern installation status
 * @param {number} state pattern selection status
 * @returns {string} Raw SVG icon data
 */
function stateIcon(state) {
  switch (state) {
    case 0:
      return iconInstall;
    case 1:
      return iconAutoInstall;
    default:
      return iconAvailable;
  }
}

/**
 * Get ARIA label for the required pattern installation status
 * @param {number} state pattern selection status
 * @returns {string} Label
 */
function stateAriaLabel(selected) {
  switch (selected) {
    case 0:
      // TRANSLATORS: pattern status, selected to install (by user)
      return _("selected");
    case 1:
      // TRANSLATORS: pattern status, selected to install (by dependencies)
      return _("automatically selected");
    default:
      // TRANSLATORS: pattern status, not selected to install
      return _("not selected");
  }
}

/**
 * Pattern component
 * @component
 * @param {Pattern} pattern pattern to display
 * @param {function} onChange callback called when the pattern status is changed
 * @returns {JSX.Element}
 */
function PatternItem({ pattern, onToggle }) {
  const [icon, setIcon] = useState();

  // download the pattern icon from the system
  useEffect(() => {
    if (icon) return;
    cockpit.file(sprintf(ICON_PATH, pattern.icon)).read()
      .then((data) => {
        setIcon(data);
      });
  }, [pattern.icon, icon]);

  const patternIcon = icon
    // use a Base64 encoded inline pattern image
    ? <img src={"data:image/svg+xml;base64," + btoa(icon)} aria-hidden="true" />
    // fallback icon
    : <Icon name="apps" aria-hidden="true" />;

  return (
    <div className="pattern-container" onClick={() => onToggle(pattern.name)}>
      <div className="pattern-checkbox">
        <img src={stateIcon(pattern.selected_by)} aria-label={stateAriaLabel(pattern.selected)} />
      </div>
      <div className="pattern-label">
        <div className="pattern-label-icon">
          {patternIcon}
        </div>
        <div className="pattern-label-text">{pattern.summary}</div>
      </div>
      <div className="pattern-summary">{pattern.description}</div>
    </div>
  );
}

export default PatternItem;
