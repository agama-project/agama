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

import React, { useState } from "react";
import { useInstallerClient } from "~/context/installer";

function PatternItem({ pattern }) {
  const [selected, setSelected] = useState(pattern.selected !== undefined);
  const client = useInstallerClient();

  const onCheckboxChange = (event) => {
    const target = event.currentTarget;

    if (target.checked) {
      console.log("Selecting pattern ", pattern.name);
      client.software.addPattern(pattern.name);
    } else {
      console.log("Removing pattern ", pattern.name);
      client.software.removePattern(pattern.name);
    }

    setSelected(target.checked);
  };

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
            checked={selected}
          />
        </div>
        <div className="pattern-label">
          <div className="pattern-label-icon">
            {/* <img
              alt="icon"
              src={"/icons/" + icon + ".svg"}
              width="32"
              height="32"
            /> */}
          </div>
          <div className="pattern-label-text">{pattern.summary}</div>
        </div>
        <div className="pattern-summary">{pattern.description}</div>
      </div>
    </label>
  );
}

export default PatternItem;
