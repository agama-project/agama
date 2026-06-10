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

import React from "react";
import { Divider, Stack, StackItem } from "@patternfly/react-core";
import DownloadFeedback from "~/components/core/DownloadFeedback";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

const MainText = ({ filename }: { filename?: string }) => (
  <Interpolate
    sentence={_(
      "The file %s contains a record of the installer activity so far, useful to diagnose installation issues.",
    )}
  >
    {() => <code>{filename}</code>}
  </Interpolate>
);

export function LogsTitle() {
  // TRANSLATORS: alert title for installation logs download
  return <>{_("Installation logs download")}</>;
}

export function LogsInfoContent({ filename }: { filename?: string }) {
  return (
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
  );
}

export function LogsSuccessContent({ filename }: { filename?: string }) {
  return (
    <Stack hasGutter>
      <StackItem>
        <MainText filename={filename} />
      </StackItem>
    </Stack>
  );
}

type DownloadLogsFeedbackProps = {
  children: (props: { download: () => void }) => React.ReactNode;
};

/**
 * Pre-configured DownloadFeedback for installation logs. Wraps the generic
 * DownloadFeedback component with logs-specific content and configuration.
 *
 * @example
 * <DownloadLogsFeedback>
 *   {({ download }) => (
 *     <Button onClick={download}>Download logs</Button>
 *   )}
 * </DownloadLogsFeedback>
 */
export default function DownloadLogsFeedback({ children }: DownloadLogsFeedbackProps) {
  return (
    <DownloadFeedback
      url={ROOT.logs}
      filenamePrefix="agama-logs"
      extension="tar.gz"
      info={{ title: LogsTitle, content: LogsInfoContent }}
      success={{ title: LogsTitle, content: LogsSuccessContent }}
    >
      {children}
    </DownloadFeedback>
  );
}
