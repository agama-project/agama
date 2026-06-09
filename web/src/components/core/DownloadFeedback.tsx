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

import React, { useRef, useState } from "react";
import { Alert, AlertActionCloseButton, AlertGroup } from "@patternfly/react-core";
import { download, isoTimestamp } from "~/utils";

type FeedbackComponent = React.ComponentType<{ filename?: string }>;

type AlertConfig = {
  /** Alert title component. */
  title: FeedbackComponent;
  /** Alert content component. */
  content: FeedbackComponent;
};

export type DownloadFeedbackProps = {
  /** URL of the resource to download. */
  url: string;
  /**
   * Prefix for the generated filename. A timestamp is appended automatically
   * at download time, e.g. `agama-logs-2024-01-15T10-30-00-000Z.tar.gz`.
   */
  filenamePrefix: string;
  /** File extension, without leading dot (e.g. `"tar.gz"`, `"json"`). */
  extension: string;
  /**
   * Render prop receiving the `download` handler to attach to a trigger
   * element such as a button or dropdown item.
   */
  children: (props: { download: () => void }) => React.ReactNode;
  /** Configuration for the info alert shown while preparing the download. */
  info: AlertConfig;
  /** Configuration for the success alert shown after download starts. */
  success: AlertConfig & {
    /** Milliseconds before the alert auto-dismisses (default: 8000). */
    timeout?: number;
  };
};

/**
 * Wraps a downloadable resource with user feedback. Renders a toast alert
 * while the file is being prepared and a success alert once the download
 * starts, then delegates trigger rendering to its children via a render prop.
 *
 * @example
 * function Title() {
 *   return <>{_("Download logs")}</>;
 * }
 *
 * function Content({ filename }) {
 *   return <div>Downloading {filename}...</div>;
 * }
 *
 * <DownloadFeedback
 *   url={ROOT.logs}
 *   filenamePrefix="agama-logs"
 *   extension="tar.gz"
 *   info={{ title: Title, content: Content }}
 *   success={{ title: Title, content: Content }}
 * >
 *   {({ download }) => (
 *     <DropdownItem onClick={download}>{_("Download logs")}</DropdownItem>
 *   )}
 * </DownloadFeedback>
 */
export default function DownloadFeedback({
  url,
  filenamePrefix,
  extension,
  info: { title: InfoTitle, content: InfoContent },
  success: { title: SuccessTitle, content: SuccessContent, timeout: successTimeout = 8000 },
  children,
}: DownloadFeedbackProps) {
  const [alert, setAlert] = useState<"pending" | "success" | null>(null);
  const [filename, setFilename] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDownload = async () => {
    const name = `${filenamePrefix}-${isoTimestamp()}.${extension}`;

    setFilename(name);
    setAlert("pending");

    try {
      await download(url, name);
      setAlert((value) => {
        if (value === "pending") {
          timeoutRef.current = setTimeout(() => setAlert(null), successTimeout);
          return "success";
        }
      });
    } catch {
      setAlert(null);
    }
  };

  const handleSuccessClose = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setAlert(null);
  };

  return (
    <>
      <AlertGroup isToast>
        {alert === "pending" && (
          <Alert
            variant="info"
            title={<InfoTitle filename={filename} />}
            actionClose={<AlertActionCloseButton onClose={() => setAlert(null)} />}
          >
            <InfoContent filename={filename} />
          </Alert>
        )}

        {alert === "success" && (
          <Alert
            variant="success"
            title={<SuccessTitle filename={filename} />}
            actionClose={<AlertActionCloseButton onClose={handleSuccessClose} />}
          >
            <SuccessContent filename={filename} />
          </Alert>
        )}
      </AlertGroup>

      {children({ download: handleDownload })}
    </>
  );
}
