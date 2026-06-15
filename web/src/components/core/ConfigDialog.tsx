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

import React, { useEffect, useState } from "react";
import { Content, Flex, Spinner } from "@patternfly/react-core";
import { CodeEditor, Language } from "@patternfly/react-code-editor";
import Popup from "~/components/core/Popup";
import { useAppearance } from "~/context/appearance";
import { ROOT } from "~/routes/paths";
import { isoTimestamp } from "~/utils";
import { _ } from "~/i18n";

type ConfigDialogProps = {
  onClose: () => void;
};

/**
 * Dialog showing the current installation configuration in JSON format, with
 * options to copy or download the content.
 */
export default function ConfigDialog({ onClose }: ConfigDialogProps) {
  const { isDark } = useAppearance();
  const [config, setConfig] = useState<string | undefined>(undefined);
  // CodeEditor appends the extension based on the language, so it must be omitted here.
  const [downloadFileName, setDownloadFileName] = useState("agama-config");

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(ROOT.config);
        const text = await response.text();
        setConfig(JSON.stringify(JSON.parse(text), null, 2));
        setDownloadFileName(`agama-config-${isoTimestamp()}`);
      } catch (error) {
        console.error("Failed to load config:", error);
        setConfig("");
      }
    };

    loadConfig();
  }, []);

  return (
    <Popup
      isOpen
      // TRANSLATORS: dialog title
      title={_("Installation settings in JSON format")}
      onClose={onClose}
      variant="medium"
    >
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        <Content>
          {_(
            "Use this to reproduce this installation later using the installer command-line interface or the unattended mode.",
          )}
        </Content>
        <CodeEditor
          isDarkTheme={isDark}
          isReadOnly
          isCopyEnabled
          isDownloadEnabled
          copyButtonAriaLabel={_("Copy to the clipboard")}
          copyButtonToolTipText={_("Copy to the clipboard")}
          copyButtonSuccessTooltipText={_("Configuration added to clipboard")}
          downloadButtonAriaLabel={_("Download configuration")}
          downloadButtonToolTipText={_("Download configuration")}
          downloadFileName={downloadFileName}
          code={config}
          emptyState={<Spinner />}
          language={Language.json}
          height="360px"
          // PatternFly merges this into its own monaco options, so settings it
          // derives from props (like readOnly from isReadOnly) are preserved.
          // Based on https://microsoft.github.io/monaco-editor/playground.html?source=v0.55.1#example-customizing-the-appearence-scrollbars
          options={{
            contextmenu: false,
            scrollBeyondLastLine: false,
            hideCursorInOverviewRuler: true,
            // TRANSLATORS: error message displayed in the JSON editor when trying to change the read-only text
            readOnlyMessage: { value: _("The configuration is read-only.") },
          }}
          // Runs in addition to PatternFly's own mount logic (e.g. Shift+Tab
          // focus handling). Disables the command palette, based on
          // https://microsoft.github.io/monaco-editor/playground.html?source=v0.55.1#example-interacting-with-the-editor-listening-to-key-events
          onEditorDidMount={(editor, monaco) => {
            editor.addCommand(monaco.KeyCode.F1, () => null);
          }}
        />
      </Flex>

      <Popup.Actions>
        {/* TRANSLATORS: button to close the config dialog */}
        <Popup.Confirm onClick={onClose}>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}
