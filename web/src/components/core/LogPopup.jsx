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

import React, { useState } from "react";
import { Popup } from "~/components/core";
import { classNames } from "~/utils";

import "./logpopup.scss";

export default function LogPopup({ className, log, onCloseCallback, title }) {
  const [isOpen, setIsOpen] = useState(true);

  const close = () => {
    setIsOpen(false);
    if (onCloseCallback) onCloseCallback();
  };

  const lines = log.split("\n").map((line, index) => {
    return <div className="d-installer-logline" key={`log-line-${index}`}>{line}</div>;
  });

  return (
    <>
      <Popup
        isOpen={isOpen}
        title={title}
        variant="large"
      >
        <div className={classNames("d-installer-logpopup", className)}>
          {lines}
        </div>

        <Popup.Actions>
          <Popup.Confirm onClick={close} autoFocus>Close</Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
}
