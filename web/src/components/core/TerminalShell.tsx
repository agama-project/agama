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

import React from "react";
import { Button, Card, CardHeader, Flex, Title } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Text from "~/components/core/Text";
import SkipTo from "~/components/core/SkipTo";
import VisualTooltip from "~/components/core/VisualTooltip";
import { TERMINAL_STOP_ID, useTerminal } from "~/context/terminal";
import { _ } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

/**
 * Header action that closes the terminal panel, ending its session.
 */
export function TerminalCloseButton() {
  const { close } = useTerminal();
  // TRANSLATORS: tooltip and accessible name for the button that ends the
  // terminal session
  const closeLabel = _("Close terminal");

  return (
    <VisualTooltip content={closeLabel} position="top">
      <Button
        variant="plain"
        aria-label={closeLabel}
        icon={<Icon name="close" />}
        onClick={close}
      />
    </VisualTooltip>
  );
}

/**
 * Card chrome shared by every terminal state: the title with its icon, an
 * optional description, the header actions, and the given body as children.
 *
 * The region is focusable programmatically (but not with Tab) so that callers
 * can send the focus to it; for example, to land on the panel when it opens.
 *
 * It opens with the same skip links as the page header, so that reaching the
 * panel with the keyboard offers a way out (back to the installer content)
 * and a way in (to the terminal, past the panel controls) before anything
 * else.
 */
export default function TerminalShell({
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
}>) {
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
        // on a terminal that can be stepped into.
        // TRANSLATORS: link that moves the focus to the terminal
        <SkipTo contentId={TERMINAL_STOP_ID} onSkip={restore} icon="terminal">
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
}
