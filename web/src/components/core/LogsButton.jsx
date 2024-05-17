/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { useCancellablePromise } from "~/utils";

import { Alert, Button } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";

const FILENAME = "agama-installation-logs.tar.bzip2";

/**
 * Button for collecting and downloading YaST logs
 * @component
 *
 * @param {object} props
 */
const LogsButton = ({ ...props }) => {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Helper function for triggering the download automatically
   *
   * @note Based on the article "Programmatic file downloads in the browser" found at
   *       https://blog.logrocket.com/programmatic-file-downloads-in-the-browser-9a5186298d5c
   *
   * @param {string} url - the file location to download from
   */
  const autoDownload = (url) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = FILENAME;

    // Click handler that releases the object URL after the element has been clicked
    // This is required to let the browser know not to keep the reference to the file any longer
    // See https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL
    const clickHandler = () => {
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.removeEventListener('click', clickHandler);
      }, 150);
    };

    // Add the click event listener on the anchor element
    a.addEventListener('click', clickHandler, false);

    // Programmatically trigger a click on the anchor element
    // Needed for make the download to happen automatically without attaching the anchor element to
    // the DOM
    a.click();
  };

  const collectAndDownload = () => {
    setError(null);
    setIsCollecting(true);
    cancellablePromise(
      client.manager.fetchLogs().then((response) => {
        if (!response.ok) {
          setError(true);
        }
        response.blob().then((blob) => {
          const url = URL.createObjectURL(blob);
          autoDownload(url);
        });
      }),
    )
      .catch((e) => {
        console.error(e);
        setError(true);
      })
      .finally(() => setIsCollecting(false));
  };

  return (
    <>
      <Button
        variant="link"
        onClick={collectAndDownload}
        isLoading={isCollecting}
        isDisabled={isCollecting}
        icon={isCollecting ? null : <Icon name="download" size="s" />}
        {...props}
      >
        {isCollecting ? _("Collecting logs...") : _("Download logs")}
      </Button>

      {isCollecting &&
        <Alert
          isInline
          isPlain
          variant="info"
          title={_("The browser will run the logs download as soon as they are ready. Please, be patient.")}
        />}

      {error &&
        <Alert
          isInline
          isPlain
          variant="warning"
          title={_("Something went wrong while collecting logs. Please, try again.")}
        />}
    </>
  );
};

export default LogsButton;
