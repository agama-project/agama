/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { Alert, Button, ButtonProps } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { _ } from "~/i18n";
import { useInstallerClient } from "~/context/installer";
import { useCancellablePromise } from "~/utils";

const FILENAME = "agama-installation-logs.tar.gz";

/**
 * Button for collecting and downloading Agama/YaST logs
 */
const LogsButton = (props: ButtonProps) => {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [error, setError] = useState(null);
  const [isCollecting, setIsCollecting] = useState(false);

  /**
   * Helper function for triggering the download automatically
   *
   * @note Based on the article "Programmatic file downloads in the browser" found at
   *       https://blog.logrocket.com/programmatic-file-downloads-in-the-browser-9a5186298d5c
   *
   * @param {string} url - the file location to download from
   */
  const autoDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = FILENAME;

    // Click handler that releases the object URL after the element has been clicked
    // This is required to let the browser know not to keep the reference to the file any longer
    // See https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL
    const clickHandler = () => {
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.removeEventListener("click", clickHandler);
      }, 150);
    };

    // Add the click event listener on the anchor element
    a.addEventListener("click", clickHandler, false);

    // Programmatically trigger a click on the anchor element
    // Needed for make the download to happen automatically without attaching the anchor element to
    // the DOM
    a.click();
  };

  const collectAndDownload = () => {
    setError(null);
    setIsCollecting(true);
    cancellablePromise(client.manager.fetchLogs().then((response) => response.blob()))
      .then(URL.createObjectURL)
      .then(autoDownload)
      .catch((error) => {
        console.error(error);
        setError(true);
      })
      .finally(() => setIsCollecting(false));
  };

  const close = () => setError(false);

  return (
    <>
      <Button
        isInline
        variant="link"
        style={{ color: "white" }}
        onClick={collectAndDownload}
        isLoading={isCollecting}
        isDisabled={isCollecting}
        {...props}
      >
        {isCollecting ? _("Collecting logs...") : _("Download logs")}
      </Button>

      <Popup title={_("Download logs")} isOpen={isCollecting || error}>
        {isCollecting && (
          <Alert
            isInline
            isPlain
            variant="info"
            title={_(
              "The browser will run the logs download as soon as they are ready. Please, be patient.",
            )}
          />
        )}

        {error && (
          <Alert
            isInline
            isPlain
            variant="warning"
            title={_("Something went wrong while collecting logs. Please, try again.")}
          />
        )}
        <Popup.Actions>
          <Popup.Confirm onClick={close} autoFocus>
            {_("Close")}
          </Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
};

export default LogsButton;
