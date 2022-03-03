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

import React from "react";

import {
  EOS_MENU as MenuIcon
} from "eos-icons-react";

/**
 * D-Installer main layout component.
 *
 * It displays the content in a single vertical responsive column with sticky
 * header and fixed footer.
 *
 * @example
 *   <Layout
 *     sectionTitle="Software"
 *     SectionIcon={SoftwareSectionIcon}
 *     FooterActions={SoftwareSectionActions}
 *   >
 *     <SoftwareSection />
 *   </Layout>
 *
 * @param {object} props - component props
 * @param {string} [props.sectionTitle] - the section title in the header
 * @param {React.ReactNode} [props.SectionIcon] - the section icon in the header
 * @param {React.ReactNode} [props.FooterMessages] - messages to be  shown in the footer
 * @param {React.ReactNode} [props.FooterActions] - actions shown in the footer
 * @param {React.ReactNode} [props.children] - the section content
 *
 */
function Layout({ sectionTitle, SectionIcon, FooterMessages, FooterActions, children: sectionContent }) {
  const responsiveWidthRules = "pf-u-w-75-on-md pf-u-w-66-on-lg pf-u-w-50-on-xl pf-u-w-33-on-2xl"
  const className = `layout ${responsiveWidthRules}`

  // FIXME: by now, it is here only for illustrating a possible app/section menu
  const renderHeaderLeftAction = () => {
    // if (!SectionAction)
    if (!MenuIcon) return null;

    return (
      <div className="layout__header-left-action">
        <MenuIcon className="layout__header-action-icon" />
      </div>
    );
  }

  const renderHeader = () => {
    return (
      <div className="layout__header">
        { renderHeaderLeftAction () }

        <div className="layout__header-section-title">
          <h1>
            { SectionIcon && <SectionIcon className="layout__header-section-title-icon" /> }
            { sectionTitle }
          </h1>
        </div>
      </div>
    );
  }

  const renderFooter = () => {
    if (!FooterActions && !FooterMessages) return null;

    return (
      <div className="layout__footer">
        <div className="layout__footer-info-area">
          { FooterMessages && <FooterMessages /> }
        </div>

        <div className="layout__footer-actions-area">
          { FooterActions && <FooterActions /> }
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      { renderHeader() }

      <main className="layout__content">
        { sectionContent }
      </main>

      { renderFooter() }
    </div>
  );
}

export default Layout;
