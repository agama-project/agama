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

import React, { useEffect, useState } from "react";
import { useInstallerClient } from "~/context/installer";
import { sprintf } from "sprintf-js";

import cockpit from "../../lib/cockpit";

import { Icon } from "../layout";

const ICON_PATH = "/usr/share/icons/hicolor/scalable/apps/%s.svg";

function PatternItem({ pattern, onChange }) {
  const client = useInstallerClient();
  const [icon, setIcon] = useState();

  const onCheckboxChange = (event) => {
    const target = event.currentTarget;

    if (target.checked) {
      console.log("Selecting pattern ", pattern.name);
      client.software.addPattern(pattern.name).then(() => onChange());
    } else {
      console.log("Removing pattern ", pattern.name);
      client.software.removePattern(pattern.name).then(() => onChange());
    }
  };

  // download the pattern icon from the system
  useEffect(() => {
    if (icon) return;
    cockpit.file(sprintf(ICON_PATH, pattern.icon)).read()
      .then((data) => {
        setIcon(data);
      });
  }, [pattern.icon, icon]);

  const patternIcon = (icon)
    // use Base64 encoded inline image
    ? <img alt="icon" src={"data:image/svg+xml;base64," + btoa(icon)} />
    : <Icon name="apps" />;

  return (
    <label htmlFor={"checkbox-pattern-" + pattern.name}>
      <div className="pattern-container">
        <div className="pattern-checkbox">
          <input
            type="checkbox"
            id={"checkbox-pattern-" + pattern.name}
            data-pattern-name={pattern.name}
            key={pattern.name}
            onChange={onCheckboxChange}
            checked={pattern.selected !== undefined}
            // disabled={pattern.selected !== undefined && pattern.selected !== 0}
          />
        </div>
        <div className="pattern-label">
          <div className="pattern-label-icon">
            { patternIcon }
          </div>
          <div className="pattern-label-text">{pattern.summary}</div>
        </div>
        <div className="pattern-summary">{pattern.description}</div>
      </div>
    </label>
  );
}

export default PatternItem;
