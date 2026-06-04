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

import React, { useState } from "react";
import {
  Alert,
  AlertActionCloseButton,
  AlertGroup,
  Divider,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import Text from "~/components/core/Text";
import Interpolate from "~/components/core/Interpolate";
import { download, isoTimestamp } from "~/utils";
import { _ } from "~/i18n";

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
  /** Milliseconds before the success alert auto-dismisses (e.g. 8000). */
  successTimeout?: number;
};

const MainText = ({ filename }) => (
  <Interpolate
    sentence={_(
      "The file %s contains a record of the installer activity so far, useful to diagnose installation issues.",
    )}
  >
    {() => <code>{filename}</code>}
  </Interpolate>
);

/**
 * Wraps a downloadable resource with user feedback. Renders a toast alert
 * while the file is being prepared and a success alert once the download
 * starts, then delegates trigger rendering to its children via a render prop.
 *
 * @example
 * <DownloadFeedback url={ROOT.logs} filenamePrefix="agama-logs" extension="tar.gz">
 *   {({ download }) => (
 *     <DropdownItem onClick={download}>{_("Download logs")}</DropdownItem>
 *   )}
 * </DownloadFeedback>
 */
export default function DownloadFeedback({
  url,
  filenamePrefix,
  extension,
  successTimeout = 8000,
  children,
}: DownloadFeedbackProps) {
  const [alert, setAlert] = useState<"pending" | "success" | null>(null);
  const [filename, setFilename] = useState("");

  const handleDownload = async () => {
    const name = `${filenamePrefix}-${isoTimestamp()}.${extension}`;

    setFilename(name);
    setAlert("pending");

    try {
      await download(url, name);
      setAlert((value) => {
        if (value === "pending") {
          setTimeout(() => setAlert(null), successTimeout);
          return "success";
        }
      });
    } catch {
      setAlert(null);
    }
  };

  const title = _("Installation logs download");

  return (
    <>
      <AlertGroup isToast>
        {alert === "pending" && (
          <Alert
            variant="info"
            title={title}
            actionClose={<AlertActionCloseButton onClose={() => setAlert(null)} />}
          >
            <Stack hasGutter>
              <StackItem>
                <MainText filename={filename} />
              </StackItem>
              <StackItem>
                <Divider />
                <Text textStyle="fontSizeXs">
                  {_(
                    "Data collection may take a while. The download will start automatically once the file is ready.",
                  )}
                </Text>
              </StackItem>
            </Stack>
          </Alert>
        )}

        {alert === "success" && (
          <Alert
            variant="success"
            title={title}
            actionClose={<AlertActionCloseButton onClose={() => setAlert(null)} />}
          >
            <Stack hasGutter>
              <StackItem>
                <MainText filename={filename} />
              </StackItem>
            </Stack>
          </Alert>
        )}
      </AlertGroup>

      {children({ download: handleDownload })}
    </>
  );
}
