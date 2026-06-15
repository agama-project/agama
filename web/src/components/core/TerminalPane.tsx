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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { useState } from "react";
import { Button, Card, CardBody, CardHeader, Flex, Title } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Text from "~/components/core/Text";
import VisualTooltip from "~/components/core/VisualTooltip";
import TerminalUnavailable from "~/components/core/TerminalUnavailable";
import { useTerminal } from "~/context/terminal";
import { _, N_ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

// Terminal action strings reserved for the translation freeze.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FUTURE_TRANSLATIONS = {
  show: N_("Show terminal"),
  hide: N_("Hide terminal"),
  open: N_("Open terminal"),
  close: N_("Close terminal"),
};

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;
const FONT_SIZE_STEP = 2;

// Fake shell session shown in the mockup; not user-facing copy, so it is
// deliberately not translated. Replace with the real terminal integration
// (an xterm.js instance attached to a shell on the installation environment).
const mockPrompt = "agama:~ # ▊";
const mockSession = `agama:~ # agama config show
{
  "product": { "id": "Tumbleweed" },
  ...
}
agama:~ # lsblk
NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
vda    253:0    0   30G  0 disk
${mockPrompt}`;

type TerminalPaneProps = {
  /**
   * Whether the panel has enough room to host a usable terminal. When `false`,
   * an explanatory message is shown instead.
   */
  enoughSpace: boolean;
};

/** Toolbar with actions for adjusting the terminal font size and clearing its output. */
const TerminalToolbar = ({
  fontSize,
  onFontSizeChange,
  onClear,
}: {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onClear: () => void;
}) => {
  // TRANSLATORS: tooltip for the button that makes the terminal text smaller
  const decreaseLabel = _("Decrease font size");
  // TRANSLATORS: tooltip for the button that makes the terminal text bigger
  const increaseLabel = _("Increase font size");
  // TRANSLATORS: tooltip for the button that clears the terminal output
  const clearLabel = _("Clear terminal");

  return (
    <Flex gap={{ default: "gapXs" }} flexWrap={{ default: "nowrap" }}>
      <VisualTooltip content={decreaseLabel} position="top">
        <Button
          variant="plain"
          aria-label={decreaseLabel}
          icon={<Icon name="text_decrease" />}
          isDisabled={fontSize <= MIN_FONT_SIZE}
          onClick={() => onFontSizeChange(fontSize - FONT_SIZE_STEP)}
        />
      </VisualTooltip>
      <VisualTooltip content={increaseLabel} position="top">
        <Button
          variant="plain"
          aria-label={increaseLabel}
          icon={<Icon name="text_increase" />}
          isDisabled={fontSize >= MAX_FONT_SIZE}
          onClick={() => onFontSizeChange(fontSize + FONT_SIZE_STEP)}
        />
      </VisualTooltip>
      <VisualTooltip content={clearLabel} position="top">
        <Button
          variant="plain"
          aria-label={clearLabel}
          icon={<Icon name="clear_all" />}
          onClick={onClear}
        />
      </VisualTooltip>
    </Flex>
  );
};

/** The mockup terminal screen. Replace with the real xterm.js terminal. */
const TerminalScreen = ({ fontSize, content }: { fontSize: number; content: string }) => (
  <pre className="agm-terminal__screen" style={{ fontSize: `${fontSize}px` }}>
    {content}
  </pre>
);

/**
 * Card chrome shared by every terminal state: the title with its icon, an
 * optional description, the header actions, and the given body as children.
 */
const TerminalShell = ({
  minimized = false,
  description,
  actions,
  children,
}: React.PropsWithChildren<{
  minimized?: boolean;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}>) => {
  // TRANSLATORS: accessible name of the terminal panel region
  const regionLabel = _("Terminal");

  return (
    <Card
      isFullHeight
      isCompact
      component="section"
      aria-label={regionLabel}
      className={minimized ? "agm-terminal agm-terminal--minimized" : "agm-terminal"}
    >
      <CardHeader actions={{ actions, hasNoOffset: true }}>
        <Flex
          direction={{ default: "column" }}
          alignItems={{ default: "alignItemsFlexStart" }}
          gap={{ default: "gapXs" }}
        >
          <Flex
            alignItems={{ default: "alignItemsCenter" }}
            flexWrap={{ default: "nowrap" }}
            gap={{ default: "gapSm" }}
          >
            <Icon name="terminal" size="lg" aria-hidden />
            <Title headingLevel="h2" className={textStyles.fontSizeSm}>
              {regionLabel}
            </Title>
          </Flex>
          {description && <Text textStyle={["textColorSubtle", "fontSizeXs"]}>{description}</Text>}
        </Flex>
      </CardHeader>
      {children}
    </Card>
  );
};

/**
 * Contents of the terminal panel: a header with its actions and the terminal
 * itself.
 *
 * When the panel is too small to host a usable terminal, it shows an
 * explanatory message instead (see {@link TerminalUnavailable}).
 */
export default function TerminalPane({ enoughSpace }: TerminalPaneProps) {
  const { hide, isMinimized, minimize, restore } = useTerminal();
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [session, setSession] = useState(mockSession);

  // TRANSLATORS: tooltip and accessible name for the button that hides the
  // terminal panel (it does not end the session)
  const hideLabel = _("Hide terminal");
  const hideButton = (
    <VisualTooltip content={hideLabel} position="top">
      <Button variant="plain" aria-label={hideLabel} icon={<Icon name="close" />} onClick={hide} />
    </VisualTooltip>
  );

  // Not enough room for a usable terminal: just explain it. The message offers
  // its own Hide action, so the header needs no actions here.
  if (!enoughSpace) {
    return (
      <TerminalShell>
        <CardBody isFilled className="agm-terminal__body">
          <TerminalUnavailable onHide={hide} />
        </CardBody>
      </TerminalShell>
    );
  }

  // TRANSLATORS: tooltip and accessible name for the button that collapses the
  // terminal panel to a bar, keeping the session
  const minimizeLabel = _("Minimize terminal");
  // TRANSLATORS: tooltip and accessible name for the button that expands the
  // collapsed terminal panel back to its full size
  const restoreLabel = _("Restore terminal");
  const toggleLabel = isMinimized ? restoreLabel : minimizeLabel;

  // TRANSLATORS: one-line summary of what the terminal is for
  const summary = _("Linux command-line with administrative privileges on the installer system.");

  const actions = (
    <Flex
      alignItems={{ default: "alignItemsCenter" }}
      flexWrap={{ default: "nowrap" }}
      gap={{ default: "gapXs" }}
    >
      {!isMinimized && (
        <TerminalToolbar
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          onClear={() => setSession(mockPrompt)}
        />
      )}
      <VisualTooltip content={toggleLabel} position="top">
        <Button
          variant="plain"
          aria-label={toggleLabel}
          icon={<Icon name={isMinimized ? "unfold_more" : "unfold_less"} />}
          onClick={isMinimized ? restore : minimize}
        />
      </VisualTooltip>
      {hideButton}
    </Flex>
  );

  return (
    <TerminalShell
      minimized={isMinimized}
      description={isMinimized ? undefined : summary}
      actions={actions}
    >
      {/* The terminal stays mounted while collapsed, so the session and its
          output are kept; only the body is hidden. */}
      <CardBody isFilled className="agm-terminal__body" hidden={isMinimized}>
        <TerminalScreen fontSize={fontSize} content={session} />
      </CardBody>
    </TerminalShell>
  );
}
