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

import { useEffect, useRef } from "react";
import { isLanguageConfirmed } from "~/components/welcome/flags";
import { useInstallerL10n } from "~/context/installerL10n";
import { useL10n } from "~/hooks/model/config/l10n";
import { languageFromLocale } from "~/utils/l10n";

/**
 * Switches the interface to the language the config sets when the installer
 * starts, as a loaded profile may, unless the user already picked one in this
 * browser.
 *
 * Only the locale found at start counts: a locale set later, such as on the
 * localization page, is the one of the system to install and leaves the
 * interface alone.
 */
export function useInterfaceLanguageFromConfig() {
  const locale = useL10n()?.locale;
  const { language, changeLanguage } = useInstallerL10n();
  const startLocale = useRef(locale);

  useEffect(() => {
    if (!startLocale.current || isLanguageConfirmed()) return;
    const configLanguage = languageFromLocale(startLocale.current);
    startLocale.current = undefined;
    if (configLanguage !== language) changeLanguage(configLanguage).catch(console.error);
    // Only once, with the locale found at start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
