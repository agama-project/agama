/*
 * Copyright (c) [2023] SUSE LLC
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

import React from "react";

/**
 * A notification mark that  icon for catching the users attention when there is
 * something that can be interesting for them but not urgent enough to use a
 * (blocking) Popup.
 *
 * @component
 *
 * Initially though to be displayed on top of the Sidebar icon.
 *
 * Use only when the information to show might be overlooked without risk and/or
 * when the information will be displayed sooner or later in other way (in a
 * confirmation dialog, for example).
 *
 * @param {object} props
 * @param {string} props.label - the label to be announced by screen readers
 */
export default function NotificationMark ({ label }) {
  return <span className="notification-mark" role="status" aria-label={label} />;
}
