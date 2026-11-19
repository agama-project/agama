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

import { isEmpty, shake } from "radashi";
import { bestKeymapFor } from "~/components/l10n/shared/keyboards";
import { useInstallerL10n } from "~/context/installerL10n";
import { useL10n } from "~/hooks/model/config/l10n";
import { useSystem } from "~/hooks/model/system";
import { localConnection } from "~/utils";
import { languageToLocale } from "~/utils/l10n";

import type { Config } from "~/model/config/l10n";

/**
 * Returns a function building the localization the product to install takes
 * from the installer: the installer language and keyboard, for whatever the
 * product does not have set yet.
 *
 * Once set, by this copy, on the localization page or by a profile, a value is
 * left alone. The function is told whether the config is being reset, as when
 * changing the product, since nothing set before survives that.
 *
 * The language is only copied when the system offers a locale for it. From a
 * remote connection the installer keyboard is not the one of the machine, so
 * the product takes the keyboard that best goes with the language, if any.
 */
export function useInstallerL10nForProduct(): (resetsConfig: boolean) => Config | undefined {
  const { language, keymap } = useInstallerL10n();
  const { l10n: system } = useSystem();
  const config = useL10n();

  return (resetsConfig) => {
    const current = resetsConfig ? null : config;
    const productLocale = () => {
      const locale = languageToLocale(language);
      return system?.locales?.find((l) => l.id === locale)?.id;
    };
    const productKeymap = () => {
      if (localConnection()) return keymap;
      return bestKeymapFor(language, system?.keymaps ?? []);
    };
    const l10n = shake({
      locale: current?.locale ? undefined : productLocale(),
      keymap: current?.keymap ? undefined : productKeymap(),
    });

    return isEmpty(l10n) ? undefined : l10n;
  };
}
