/*
 * Copyright (c) [2022] SUSE LLC
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

import React from 'react';

// NOTE: "~icons" is an alias to use a shorter path to real icons location.
//       Check the tsconfig.json file to see its value.
import Inventory from "~icons/inventory_2.svg";
import Translate from "~icons/translate.svg";
import SettingsEthernet from "~icons/settings_ethernet.svg";
import EditSquare from "~icons/edit_square.svg";
import Edit from "~icons/edit.svg";
import HardDrive from "~icons/hard_drive.svg";
import ManageAccounts from "~icons/manage_accounts.svg";
import HomeStorage from "~icons/home_storage.svg";
import Problem from "~icons/problem.svg";
import Error from "~icons/error.svg";
import CheckCircle from "~icons/check_circle.svg";
import TaskAlt from "~icons/task_alt.svg";
import Downloading from "~icons/downloading.svg";
import MoreVert from "~icons/more_vert.svg";
import Wifi from "~icons/wifi.svg";
import Lan from "~icons/lan.svg";
import Lock from "~icons/lock.svg";
import SignalCellularAlt from "~icons/signal_cellular_alt.svg";
import SettingsFill from "~icons/settings-fill.svg";
import SettingsApplications from "~icons/settings_applications.svg";
import Info from "~icons/info.svg";
import Delete from "~icons/delete.svg";
import Warning from "~icons/warning.svg";
import Loading from "./three-dots-loader-icon.svg";

const icons = {
  check_circle: CheckCircle,
  delete: Delete,
  downloading: Downloading,
  edit: Edit,
  edit_square: EditSquare,
  error: Error,
  hard_drive: HardDrive,
  home_storage: HomeStorage,
  info: Info,
  inventory_2: Inventory,
  lan: Lan,
  loading: Loading,
  lock: Lock,
  manage_accounts: ManageAccounts,
  more_vert: MoreVert,
  problem: Problem,
  settings: SettingsFill,
  settings_applications: SettingsApplications,
  settings_ethernet: SettingsEthernet,
  signal_cellular_alt: SignalCellularAlt,
  task_alt: TaskAlt,
  translate: Translate,
  warning: Warning,
  wifi: Wifi,
};

/**
 * D-Installer Icon component
 *
 * If exists, it renders requested icon with given size.
 *
 * @todo: import icons dynamically if the list grows too much. See
 *   - https://stackoverflow.com/a/61472427
 *   - https://ryanhutzley.medium.com/dynamic-svg-imports-in-create-react-app-d6d411f6d6c6
 *
 * @todo: find how to render the "icon not found" warning only in _development_ mode
 *
 * @example
 *   <Icon name="warning" size="16" />
 *
 * @param {object} props - component props
 * @param {string} props.name - desired icon
 * @param {string|number} [props.size=32] - the icon width and height
 * @param {object} [props.otherProps] other props sent to SVG icon
 *
 */
export default function Icon({ name, size = 32, ...otherProps }) {
  const IconComponent = icons[name];

  return (IconComponent)
    ? <IconComponent width={size} height={size} {...otherProps} />
    : <em>`icon ${name} not found!`</em>;
}
