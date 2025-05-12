/*
 * Copyright (c) [2025] SUSE LLC
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
import { Button, Flex } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { InstallerOptions } from "~/components/core";
import { useLocation } from "react-router-dom";
import { useInstallerStatus } from "~/queries/status";
import { useInstallerL10n } from "~/context/installerL10n";
import { InstallationPhase } from "~/types/status";
import { _ } from "~/i18n";
import supportedLanguages from "~/languages.json";

const LanguageIcon = () => <Icon name="translate" />;
const KeyboardIcon = () => <Icon name="keyboard" />;

/**
 * Component for displaying Language and Keyboard selection
 */
export default function LanguageAndKeyboard() {
  const location = useLocation();
  const { phase } = useInstallerStatus({ suspense: true });
  const { language, keymap } = useInstallerL10n();
  const [isOpen, setIsOpen] = useState(false);

  const skip =
    phase === InstallationPhase.Install ||
    ["/login", "/products/progress"].includes(location.pathname);

  if (skip) return;

  return (
    <>
      <Button
        id="language-and-keyboard"
        onClick={() => setIsOpen(true)}
        aria-label={_("Change display language and keyboard layout")}
        variant="plain"
        icon={
          <Flex
            gap={{ default: "gapXs" }}
            alignContent={{ default: "alignContentCenter" }}
            alignItems={{ default: "alignItemsCenter" }}
          >
            <LanguageIcon /> {supportedLanguages[language]} <KeyboardIcon /> {keymap}
          </Flex>
        }
      />
      <InstallerOptions isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
