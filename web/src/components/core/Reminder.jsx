/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import { Icon } from "~/components/layout";

/**
 * Internal component for rendering the icon
 *
 * @param {object} props
 * @params {string} [props.name] - The icon name.
 */
const ReminderIcon = ({ name }) => {
  if (!name?.length) return;

  return (
    <div>
      <Icon name={name} size="xs" />
    </div>
  );
};

/**
 * Internal component for rendering the title
 *
 * @param {object} props
 * @params {JSX.Element|string} [props.children] - The title content.
 */
const ReminderTitle = ({ children }) => {
  if (!children) return;
  if (typeof children === "string" && !children.length) return;

  return (
    <h4>{children}</h4>
  );
};

/**
 * Renders a reminder with given role, status by default
 * @component
 *
 * @param {object} props
 * @param {string} [props.icon] - The name of desired icon.
 * @param {JSX.Element|string} [props.title] - The content for the title.
 * @param {string} [props.role="status"] - The reminder's role, "status" by
 *   default. See {@link https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role}
 * @param {JSX.Element} [props.children] - The content for the description.
 */
export default function Reminder ({
  icon,
  title,
  role = "status",
  children
}) {
  return (
    <div role={role} data-type="agama/reminder">
      <ReminderIcon name={icon} />
      <div>
        <ReminderTitle>{title}</ReminderTitle>
        { children }
      </div>
    </div>
  );
}
