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
import { Flex, Stack } from "@patternfly/react-core";
import Page from "~/components/layout/Page";
import Icon, { IconProps } from "~/components/layout/Icon";
import Text from "~/components/core/Text";
import RebootButton from "~/components/core/RebootButton";
import SplitButton from "~/components/core/SplitButton";
import DownloadLogsFeedback from "~/components/core/DownloadLogsFeedback";
import SideBySideLayout from "~/components/layout/SideBySideLayout";
import { useTerminal } from "~/context/terminal";
import { _ } from "~/i18n";

/**
 * Renders an action label with a leading icon.
 *
 * The icon and the text are kept inline on purpose: PatternFly aligns the
 * pieces of a split button on their text baseline, and a flex wrapper would
 * offer the icon bottom edge instead, growing the button.
 */
const ActionContent = ({ icon, text }: { icon: IconProps["name"]; text: string }) => (
  <>
    <Icon name={icon} isMiddleAligned /> {text}
  </>
);

/**
 * Installation failure screen
 *
 * Displays an error page when the installation process fails, providing users
 * with options to download logs, open a terminal to investigate, and reboot
 * the system to retry.
 *
 */
export default function InstallationFailed() {
  const { isOpen: isTerminalOpen, toggle: toggleTerminal } = useTerminal();
  const terminalLabel = isTerminalOpen
    ? /* TRANSLATORS: action that closes the terminal, ending the session */
      _("Close terminal")
    : /* TRANSLATORS: action that opens a terminal to inspect the failed installation */
      _("Open terminal");

  return (
    <Page variant="minimal">
      <Page.Content>
        <SideBySideLayout
          icon="report"
          title={_("Installation failed")}
          description={
            <Stack hasGutter>
              <Text>{_("Download logs to troubleshoot or share with support.")}</Text>
              <Text component="small">{_("Reboot to try again.")}</Text>
            </Stack>
          }
        >
          <Flex gap={{ default: "gapSm" }} alignItems={{ default: "alignItemsCenter" }}>
            <RebootButton size="default" />
            {/* DownloadLogsFeedback must wrap the whole SplitButton so the
                feedback alert survives the menu opening and closing. */}
            <DownloadLogsFeedback>
              {({ download: downloadLogs }) => (
                <SplitButton
                  variant="secondary"
                  onClick={downloadLogs}
                  label={
                    /* TRANSLATORS: action to download the installer logs as an archive */
                    <ActionContent icon="download" text={_("Download logs")} />
                  }
                >
                  <SplitButton.Item onClick={toggleTerminal}>
                    <ActionContent icon="terminal" text={terminalLabel} />
                  </SplitButton.Item>
                </SplitButton>
              )}
            </DownloadLogsFeedback>
          </Flex>
        </SideBySideLayout>
      </Page.Content>
    </Page>
  );
}
