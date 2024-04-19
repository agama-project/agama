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

import React, { useState, useEffect } from "react";
import { Popup } from "~/components/core";
import { Alert } from "@patternfly/react-core";
import { Loading } from "~/components/layout";
import { _ } from "~/i18n";

import cockpit from "../../lib/cockpit";

export default function FileViewer({ file, title, onCloseCallback }) {
  // the popup is visible
  const [isOpen, setIsOpen] = useState(true);
  // error message for failed load
  const [error, setError] = useState(null);
  // the file content
  const [content, setContent] = useState("");
  // current state
  const [state, setState] = useState("loading");

  useEffect(() => {
    // NOTE: reading non-existing files in cockpit does not fail, the result is null
    // see https://cockpit-project.org/guide/latest/cockpit-file
    cockpit.file(file).read()
      .then((data) => {
        setState("ready");
        setContent(data);
      })
      .catch((data) => {
        setState("ready");
        setError(data.message);
      });
  }, [file]);

  const close = () => {
    setIsOpen(false);
    if (onCloseCallback) onCloseCallback();
  };

  return (
    <Popup
      isOpen={isOpen}
      title={title || file}
      blockSize="large"
      inlineSize="large"
    >
      {state === "loading" && <Loading text={_("Reading file...")} />}
      {(content === null || error) &&
        <Alert
          isInline
          isPlain
          variant="warning"
          title={_("Cannot read the file")}
        >
          {error}
        </Alert>}
      <div className="filecontent">
        {content}
      </div>

      <Popup.Actions>
        <Popup.Confirm onClick={close} autoFocus>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}
