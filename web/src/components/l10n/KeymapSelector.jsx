/*
 * Copyright (c) [2023-2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { _ } from "~/i18n";
import { ListSearch, Selector } from "~/components/core";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/l10n").Keymap} Keymap
 */

const renderKeymapOption = (keymap) => (
  <div data-items-type="agama/keymaps">
    <div>{keymap.name}</div>
    <div>{keymap.id}</div>
  </div>
);

/**
 * Component for selecting a keymap.
 * @component
 *
 * @param {Object} props
 * @param {string} [props.value] - Id of the currently selected keymap.
 * @param {Keymap[]} [props.keymap] - Keymaps for selection.
 * @param {(id: string) => void} [props.onChange] - Callback to be called when the selected keymap
 *  changes.
 */
export default function KeymapSelector({ value, keymaps = [], onChange = noop }) {
  const [filteredKeymaps, setFilteredKeymaps] = useState(keymaps);

  // TRANSLATORS: placeholder text for search input in the keyboard selector.
  const helpSearch = _("Filter by description or keymap code");
  const onSelectionChange = (selection) => onChange(selection[0]);

  return (
    <>
      <div className="sticky-top-0">
        <ListSearch placeholder={helpSearch} elements={keymaps} onChange={setFilteredKeymaps} />
      </div>
      <Selector
        // FIXME: when filtering, these are not the available keymaps but the
        // filtered ones.
        aria-label={_("Available keymaps")}
        options={filteredKeymaps}
        renderOption={renderKeymapOption}
        selectedIds={[value]}
        onSelectionChange={onSelectionChange}
      />
    </>
  );
}
