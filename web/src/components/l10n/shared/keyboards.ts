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

/**
 * The keyboard layout that best goes with each installer language.
 *
 * A frontend workaround until the backend provides it: langtable ranks
 * keyboards per language and territory, but the installer does not expose that
 * ranking yet.
 */

import type { Keymap } from "~/model/system/l10n";

/**
 * Keymaps that usually go with each installer language, best first. Languages
 * with no single obvious layout (English, Indonesian, Chinese) have none.
 */
const KEYMAPS_FOR_LANGUAGE: Record<string, string[]> = {
  "ca-ES": ["es-cat", "es"],
  "de-DE": ["de", "de-nodeadkeys"],
  "es-ES": ["es"],
  "fr-FR": ["fr", "fr-latin9"],
  "it-IT": ["it"],
  "ja-JP": ["jp", "jp106"],
  "ka-GE": ["ge"],
  "pt-BR": ["br", "br-abnt2"],
  "ru-RU": ["ru"],
  "sv-SE": ["se", "sv-latin1"],
  "uk-UA": ["ua"],
};

/**
 * The best keymap for the given installer language among the available ones,
 * or undefined when there is no match.
 */
export function bestKeymapFor(language: string, keymaps: Keymap[]): string | undefined {
  const available = new Set(keymaps.map((k) => k.id));
  return KEYMAPS_FOR_LANGUAGE[language]?.find((id) => available.has(id));
}
