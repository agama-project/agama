/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";

// NOTE: "@icons" is an alias to use a shorter path to real @material-symbols
// icons location. Check the tsconfig.json file to see its value.
import AddAPhoto from "@icons/add_a_photo.svg?component";
import AutoMode from "@icons/auto_mode.svg?component";
import Apps from "@icons/apps.svg?component";
import Badge from "@icons/badge.svg?component";
import CheckCircle from "@icons/check_circle.svg?component";
import ChevronRight from "@icons/chevron_right.svg?component";
import Delete from "@icons/delete.svg?component";
import Description from "@icons/description.svg?component";
import Download from "@icons/download.svg?component";
import Downloading from "@icons/downloading.svg?component";
import Edit from "@icons/edit.svg?component";
import EditSquare from "@icons/edit_square.svg?component";
import Error from "@icons/error.svg?component";
import ExpandMore from "@icons/expand_more.svg?component";
import Folder from "@icons/folder.svg?component";
import FolderOff from "@icons/folder_off.svg?component";
import HardDrive from "@icons/hard_drive.svg?component";
import Help from "@icons/help.svg?component";
import HomeStorage from "@icons/home_storage.svg?component";
import Info from "@icons/info.svg?component";
import Inventory from "@icons/inventory_2.svg?component";
import Lan from "@icons/lan.svg?component";
import Lock from "@icons/lock.svg?component";
import ManageAccounts from "@icons/manage_accounts.svg?component";
import Menu from "@icons/menu.svg?component";
import MenuOpen from "@icons/menu_open.svg?component";
import MoreVert from "@icons/more_vert.svg?component";
import Person from "@icons/person.svg?component";
import Problem from "@icons/problem.svg?component";
import Refresh from "@icons/refresh.svg?component";
import SettingsApplications from "@icons/settings_applications.svg?component";
import SettingsEthernet from "@icons/settings_ethernet.svg?component";
import SettingsFill from "@icons/settings-fill.svg?component";
import SignalCellularAlt from "@icons/signal_cellular_alt.svg?component";
import Storage from "@icons/storage.svg?component";
import TaskAlt from "@icons/task_alt.svg?component";
import Terminal from "@icons/terminal.svg?component";
import Translate from "@icons/translate.svg?component";
import Tune from "@icons/tune.svg?component";
import Warning from "@icons/warning.svg?component";
import Visibility from "@icons/visibility.svg?component";
import VisibilityOff from "@icons/visibility_off.svg?component";
import Wifi from "@icons/wifi.svg?component";
import WifiFind from "@icons/wifi_find.svg?component";

// Icons from react-simple-icons

import { SiLinux, SiWindows } from "@icons-pack/react-simple-icons";

// Icons from SVG
import Loading from "./three-dots-loader-icon.svg?component";

const icons = {
  add_a_photo: AddAPhoto,
  auto_mode: AutoMode,
  apps: Apps,
  badge: Badge,
  check_circle: CheckCircle,
  chevron_right: ChevronRight,
  delete: Delete,
  description: Description,
  download: Download,
  downloading: Downloading,
  edit: Edit,
  edit_square: EditSquare,
  error: Error,
  expand_more: ExpandMore,
  folder: Folder,
  folder_off: FolderOff,
  hard_drive: HardDrive,
  help: Help,
  home_storage: HomeStorage,
  info: Info,
  inventory_2: Inventory,
  lan: Lan,
  loading: Loading,
  lock: Lock,
  manage_accounts: ManageAccounts,
  menu: Menu,
  menu_open: MenuOpen,
  more_vert: MoreVert,
  person: Person,
  problem: Problem,
  refresh: Refresh,
  settings: SettingsFill,
  settings_applications: SettingsApplications,
  settings_ethernet: SettingsEthernet,
  signal_cellular_alt: SignalCellularAlt,
  storage: Storage,
  task_alt: TaskAlt,
  terminal: Terminal,
  translate: Translate,
  tune: Tune,
  visibility: Visibility,
  visibility_off: VisibilityOff,
  warning: Warning,
  wifi: Wifi,
  wifi_find: WifiFind,
  // brand icons
  linux_logo: SiLinux,
  windows_logo: SiWindows
};

/**
 * Agama Icon component
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
 * @param {string} [props.className=""] - CSS classes
 * @param {string|number} [props.size=32] - the icon width and height
 * @param {object} [props.otherProps] other props sent to SVG icon
 *
 */
export default function Icon({ name, className = "", size = 32, ...otherProps }) {
  const IconComponent = icons[name];
  className = `${className} icon-size-${size}`.trim();

  return (IconComponent)
    ? <IconComponent className={className} aria-hidden="true" {...otherProps} />
    : <em>{sprintf(_("Icon %s not found!"), name)}</em>;
}
