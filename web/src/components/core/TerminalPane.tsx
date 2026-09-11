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

import React, { useCallback, useRef, useState } from "react";
import { Button, Card, CardBody, CardHeader, Flex, Title } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Text from "~/components/core/Text";
import SkipTo, { MAIN_CONTENT_ID } from "~/components/core/SkipTo";
import VisualTooltip from "~/components/core/VisualTooltip";
import TerminalUnavailable from "~/components/core/TerminalUnavailable";
import { TERMINAL_HINT_ID, TERMINAL_INPUT_ID, useTerminal } from "~/context/terminal";
import { useTerminalSession } from "~/hooks/use-terminal-session";
import { _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;
const FONT_SIZE_STEP = 2;

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

/**
 * How to get the keyboard focus back out of the terminal.
 *
 * Once the terminal has the focus, every key press goes to the shell, so the
 * sequence that gets it back (see `useTerminalSession`) has to be told rather
 * than guessed. The terminal input points at this text, so it is announced on
 * arrival instead of only being there to be read.
 */
const KeyboardHint = () => {
  // TRANSLATORS: how to move the keyboard focus out of the terminal, where
  // every key press otherwise goes to the shell. %1$s, %2$s and %3$s are the
  // Ctrl, Shift and L keys, pressed together, and are shown as keys.
  const hint = _("%1$s+%2$s+%3$s to move focus out");
  const keys: Record<string, string> = {
    // TRANSLATORS: the Control key, as labeled on the keyboard
    "%1$s": _("Ctrl"),
    // TRANSLATORS: the Shift key, as labeled on the keyboard
    "%2$s": _("Shift"),
    "%3$s": "L",
  };

  return (
    // A side note to the terminal it sits under, marked up (and read) as one
    // step quieter than the text around it.
    <Text id={TERMINAL_HINT_ID} component="small" textStyle={["textColorSubtle", "fontSizeXs"]}>
      {hint
        .split(/(%[123]\$s)/)
        .map((part, index) => (keys[part] ? <kbd key={index}>{keys[part]}</kbd> : part))}
    </Text>
  );
};

/**
 * Card chrome shared by every terminal state: the title with its icon, an
 * optional description, the header actions, and the given body as children.
 *
 * The region is focusable programmatically (but not with Tab) so that callers
 * can send the focus to it; see {@link TerminalPane}.
 *
 * It opens with the same skip links as the page header, so that reaching the
 * panel with the keyboard offers a way out (back to the installer content)
 * and a way in (straight to the terminal, past the panel controls) before
 * anything else.
 */
const TerminalShell = ({
  regionRef,
  hasTerminal = false,
  minimized = false,
  description,
  actions,
  children,
}: React.PropsWithChildren<{
  regionRef?: React.Ref<HTMLDivElement>;
  hasTerminal?: boolean;
  minimized?: boolean;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}>) => {
  const { restore } = useTerminal();
  // TRANSLATORS: accessible name of the terminal panel region
  const regionLabel = _("Terminal");

  return (
    <Card
      ref={regionRef}
      tabIndex={-1}
      isFullHeight
      isCompact
      component="section"
      aria-label={regionLabel}
      className={minimized ? "agm-terminal agm-terminal--minimized" : "agm-terminal"}
    >
      <SkipTo />
      {hasTerminal && (
        // Collapsed panels are expanded on the way, so the link always lands
        // on a terminal ready to type in.
        // TRANSLATORS: link that moves the focus into the terminal itself
        <SkipTo contentId={TERMINAL_INPUT_ID} onSkip={restore} icon="terminal">
          {_("Skip to terminal")}
        </SkipTo>
      )}
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
  const { close, isMinimized, minimize, restore } = useTerminal();
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  // A state (rather than a plain ref) so `useTerminalSession` notices when
  // the container appears (e.g., once there is enough room for it) or
  // changes, and can (re)attach the terminal to it.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => setContainer(node), []);
  const regionRef = useRef<HTMLDivElement>(null);
  // Where the focus lands when the user leaves the terminal with the keyboard
  // (see `useTerminalSession`): the panel's "Skip to content" link, so Enter
  // goes straight back to the installer content, Tab reaches the way back
  // into the terminal, and Shift+Tab the rest of the interface. The panel
  // itself takes the focus if the link is not there.
  const leaveTerminal = useCallback(() => {
    const region = regionRef.current;
    const skipToContent = region?.querySelector<HTMLElement>(`a[href="#${MAIN_CONTENT_ID}"]`);
    (skipToContent ?? region)?.focus();
  }, []);
  const { setFontSize: setSessionFontSize, clear } = useTerminalSession(container, {
    onLeave: leaveTerminal,
    onGracefulExit: close,
  });

  const changeFontSize = (size: number) => {
    setFontSize(size);
    setSessionFontSize(size);
  };

  // TRANSLATORS: tooltip and accessible name for the button that ends the
  // terminal session
  const closeLabel = _("Close terminal");
  const closeButton = (
    <VisualTooltip content={closeLabel} position="top">
      <Button
        variant="plain"
        aria-label={closeLabel}
        icon={<Icon name="close" />}
        onClick={close}
      />
    </VisualTooltip>
  );

  // Not enough room for a usable terminal: just explain it. The message offers
  // its own Close action, so the header needs no actions here.
  if (!enoughSpace) {
    return (
      <TerminalShell regionRef={regionRef}>
        <CardBody isFilled className="agm-terminal__body">
          <TerminalUnavailable onClose={close} />
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
        <TerminalToolbar fontSize={fontSize} onFontSizeChange={changeFontSize} onClear={clear} />
      )}
      <VisualTooltip content={toggleLabel} position="top">
        <Button
          variant="plain"
          aria-label={toggleLabel}
          icon={<Icon name={isMinimized ? "select_window" : "minimize"} />}
          onClick={isMinimized ? restore : minimize}
        />
      </VisualTooltip>
      {closeButton}
    </Flex>
  );

  return (
    <TerminalShell
      regionRef={regionRef}
      hasTerminal
      minimized={isMinimized}
      description={isMinimized ? undefined : summary}
      actions={actions}
    >
      {/* The terminal stays mounted while collapsed, so the session and its
          output are kept; only the body is hidden. */}
      <CardBody isFilled className="agm-terminal__body">
        <div className="agm-terminal__screen">
          <div ref={containerRef} className="agm-terminal__container" />
        </div>
        <KeyboardHint />
      </CardBody>
    </TerminalShell>
  );
}
