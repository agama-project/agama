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

import React, { useState } from "react";
import { Icon } from '~/components/layout';

/**
 * Build and render an accessible disclosure
 * @component
 *
 * TODO: use inert and/or hidden/hidden="until-found" attribute for the panel?
 *  https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert
 *  https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/hidden
 *
 * FIXME: do not send all otherProps to the icon but only the
 *  data-keep-sidebar-open attribute for being able keep the sidebar open
 *
 * @example <caption>Simple usage</caption>
 *   <Disclosure label="Developer tools">
 *     <DeveloperTools />
 *   </Disclosure>
 *
 * @example <caption>Sending attributes to the button</caption>
 *   <Disclosure label="Developer tools" data-keep-sidebar-open>
 *     <DeveloperTools />
 *   </Disclosure>
 *
 * @param {object} props
 * @param {string} props.label - the label to be used as button text
 * @param {React.ReactElement} props.children - the section content
 * @param {object} props.otherProps - rest of props, sent to the button element
 */
export default function Disclosure({ label, children, ...otherProps }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggle = () => setIsExpanded(!isExpanded);

  return (
    <div className="disclosure">
      <button
        aria-expanded={isExpanded}
        className="plain-button"
        onClick={toggle}
        {...otherProps}
      >
        <Icon name="chevron_right" size="s" />
        {label}
      </button>
      <div className="flex-stack">
        {children}
      </div>
    </div>
  );
}
