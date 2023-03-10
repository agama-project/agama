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

// @ts-check

import React from "react";
import { PageOptionsContent } from '~/components/layout';

/**
 * Wrapper for teleported page options that bubbles onClick
 * event to the slot element.
 *
 * Needed to "dispatch" the onClick events bind to any
 * parent on the DOM tree for "teleported nodes", bypassing the
 * default React Portal behavior of bubbling events up through the
 * React tree only.
 *
 * @example <caption>Simple usage</caption>
 *   <PageOptions title="Storage options">
 *     <Link to="/storage/iscsi">Configure iSCSI devices</Link>
 *     <Button
 *       onClick={showStorageHwInfo}
 *       data-keep-sidebar-open
 *     >
 *       Show Storage Hardaware info
 *     </Button>
 *   </PageOptions>
 *
 * @param {object} props
 * @param {string} [props.title="Page options"] - a title for the group
 * @param {string} [props.className="flex-stack"] - CSS class for the wrapper div
 * @param {React.ReactElement} props.children - the teleported content
 */
export default function PageOptions({
  title = "Page options",
  className = "flex-stack",
  children
}) {
  const forwardEvents = (target) => {
    return (
      <div
        className={className}
        onClick={ e => {
          // Using a CustomEvent because the originalTarget is needed to check the dataset.
          // See Sidebar.jsx for better understanding
          const customEvent = new CustomEvent(
            e.type,
            { ...e, detail: { originalTarget: e.target } }
          );
          target.dispatchEvent(customEvent);
        }}
      >
        <h3>{title}</h3>
        {children}
      </div>
    );
  };

  return (
    <PageOptionsContent>
      { (target) => forwardEvents(target) }
    </PageOptionsContent>
  );
}
