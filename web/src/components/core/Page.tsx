/*
 * Copyright (c) [2023-2026] SUSE LLC
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

import React, { Suspense, useId } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import Link, { LinkProps } from "~/components/core/Link";
import {
  Button,
  ButtonProps,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardProps,
  Divider,
  Flex,
  FlexItem,
  Masthead,
  Page as PFPage,
  PageGroup,
  PageSection,
  PageSectionProps,
  Split,
  Title,
  TitleProps,
} from "@patternfly/react-core";
import { isEmpty } from "radashi";
import type { ProgressBackdropProps } from "~/components/core/ProgressBackdrop";
import ProgressBackdrop from "~/components/core/ProgressBackdrop";
import Header, { HeaderProps } from "~/components/layout/Header";
import Loading from "~/components/layout/Loading";
import InstallerL10nOptions from "~/components/core/InstallerL10nOptions";
import InstallerOptionsMenu from "~/components/core/InstallerOptionsMenu";
import ProgressStatusMonitor from "~/components/core/ProgressStatusMonitor";
import AppearanceSettings from "~/components/core/AppearanceSettings";
import Questions from "~/components/questions/Questions";
import { PRODUCT, ROOT } from "~/routes/paths";
import { _, TranslatedString } from "~/i18n";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

/**
 * Ways of naming a section, which are mutually exclusive.
 *
 * A visible title is always preferable, so an invisible label is never
 * accepted next to it.
 */
type SectionNameProps =
  | {
      /** The section title, rendered as a heading and used as accessible name */
      title: React.ReactNode;
      "aria-label"?: never;
    }
  | {
      title?: never;
      /**
       * Accessible name for a section with no visible title.
       *
       * Last resort: prefer a title, which names the section for everybody.
       */
      "aria-label"?: TranslatedString;
    };

/**
 * Props accepted by Page.Section
 */
type SectionProps = SectionNameProps & {
  /** Actions to display next to the title */
  titleActions?: React.ReactNode;
  /** Elements to be rendered in the section footer */
  actions?: React.ReactNode;
  /** A React node with a brief description of what the section is for */
  description?: React.ReactNode;
  /** The heading level used for the section title */
  headingLevel?: TitleProps["headingLevel"];
  /** Whether the section should have a divider between header and body */
  hasHeaderDivider?: boolean;
  /** Props to influence PF/Card component wrapping the section */
  pfCardProps?: CardProps;
};

type CancelProps = Omit<LinkProps, "to"> & {
  /** Path to navigate to */
  navigateTo?: LinkProps["to"];
};

type SubmitActionProps = {
  /** The id of a <form> the submit button is associated with */
  form?: string;
} & ButtonProps;

const defaultCardProps: CardProps = {
  isCompact: true,
  isFullHeight: true,
};

/**
 * Groups related page content in a card, built on top of PF/Card.
 *
 * A named section is a region: it shows up in the landmark list, letting
 * screen reader users jump straight to it. An unnamed one is a plain visual
 * grouping, so how the section is named decides what it becomes:
 *
 * - with a `title`: a region named after the visible heading.
 * - with an `aria-label` and no title: a region named after that label.
 * - with neither: no region, just a card.
 *
 * @example <caption>A plain grouping, no name needed</caption>
 *   <Page.Section>
 *     <EncryptionSummary />
 *   </Page.Section>
 *
 * @example <caption>A region named "Encryption"</caption>
 *   <Page.Section
 *     title="Encryption"
 *     description="Whether device should be protected or not"
 *     actions={isEnabled ? <DisableAction /> : <EnableAction />}
 *   >
 *     <EncryptionSummary />
 *   </Page.Section>
 */
const Section = ({
  title,
  titleActions,
  "aria-label": ariaLabel,
  description,
  actions,
  headingLevel = "h3",
  hasHeaderDivider = false,
  pfCardProps,
  children,
}: React.PropsWithChildren<SectionProps>) => {
  const titleId = useId();
  const hasTitle = !isEmpty(title);
  const hasDescription = !isEmpty(description);
  const hasHeader = hasTitle || hasDescription;
  const hasAriaLabel = !isEmpty(ariaLabel);

  const props: CardProps = {
    ...defaultCardProps,
    // Only a named section becomes a region, so an unnamed one must not render
    // a section element at all.
    component: hasTitle || hasAriaLabel ? "section" : "div",
    ...(hasTitle && { "aria-labelledby": titleId }),
    ...(hasAriaLabel && { "aria-label": ariaLabel }),
  };

  return (
    <Card {...props} {...pfCardProps}>
      {hasHeader && (
        <CardHeader>
          {hasTitle && (
            <Flex>
              <Title id={titleId} headingLevel={headingLevel}>
                {title}
              </Title>
              {titleActions && (
                <>
                  <FlexItem grow={{ default: "grow" }} />
                  {titleActions}
                </>
              )}
            </Flex>
          )}
          {hasDescription && <div className={textStyles.textColorPlaceholder}>{description}</div>}
        </CardHeader>
      )}
      {hasHeaderDivider && <Divider />}
      <CardBody>{children}</CardBody>
      {actions && (
        <CardFooter>
          <Split hasGutter>{actions}</Split>
        </CardFooter>
      )}
    </Card>
  );
};

/**
 * Handy component for rendering a "Cancel" action
 *
 * NOTE: by default it navigates to the top path, which can be changed
 * `navigateTo` prop BUT not for navigating back into the history. Use Page.Back
 * for the latest, which behaves differently.
 */
const Cancel = ({ navigateTo = "..", children, ...props }: CancelProps) => {
  return (
    <Link to={navigateTo} variant="link" keepQuery {...props}>
      {children || _("Cancel")}
    </Link>
  );
};

/**
 * Handy component for rendering a "Back" action
 *
 * NOTE: It does not behave like Page.Cancel, since does not support changing
 * the path to navigate to, and always goes one path back in the history (-1)
 *
 * NOTE: Not using Page.Cancel for practical reasons about useNavigate
 * overloading, which kind of forces to write an ugly code for supporting both
 * types, "To" and "number", without a TypeScript complain. To know more, see
 * https://github.com/remix-run/react-router/issues/10505#issuecomment-2237126223
 */
const Back = ({ children, ...props }: Omit<ButtonProps, "onClick">) => {
  const navigate = useNavigate();

  return (
    <Button variant="link" {...props} onClick={() => navigate(-1)}>
      {children || _("Back")}
    </Button>
  );
};

/**
 * Handy component to submit a form matching the id given in the `form` prop
 */
const Submit = ({ children, ...props }: SubmitActionProps) => {
  return (
    <Button type="submit" {...props}>
      {children || _("Accept")}
    </Button>
  );
};

/**
 * Wrapper for the section content built on top of PF/Page/PageSection
 *
 * @see [Patternfly Page/PageSection](https://www.patternfly.org/components/page#pagesection)
 */
const Content = ({ children, ...pageSectionProps }: PageSectionProps) => {
  return (
    <PageSection hasBodyWrapper={false} isFilled component="div" {...pageSectionProps}>
      {children}
    </PageSection>
  );
};

/**
 * Props for standard page variant.
 */
type StandardPageProps = React.PropsWithChildren<
  HeaderProps & {
    /** Layout variant to use */
    variant?: "standard";
    /** Optional progress tracking configuration */
    progress?: ProgressBackdropProps;
    /** Whether to show the Questions component at the bottom of the page */
    showQuestions?: boolean;

    /**
     * If true, the ProgressStatusMonitor will not be automatically
     * injected among the header default tools.
     *
     * Default: `false` (ProgressStatusMonitor is injected)
     */
    noDefaultProgressMonitor?: boolean;

    /**
     * Whether the localization selector in the header should display its current
     * values (language and keyboard) next to the icons.
     *
     * Default: `false` (icon-only, to save space in the header)
     */
    showL10nValues?: boolean;
  }
>;

/**
 * Props for minimal page variant.
 *
 * The minimal layout renders an empty masthead and nothing but the given
 * content, so it takes no header, progress or questions props.
 */
type MinimalPageProps = React.PropsWithChildren<{
  /** Layout variant - minimal layout with empty masthead (e.g., for login pages) */
  variant: "minimal";
}>;

/**
 * Props for the `Page` component, one set per layout variant.
 */
type PageProps = StandardPageProps | MinimalPageProps;

/**
 * Minimal page layout with empty masthead.
 */
const MinimalLayout = ({ children }: Omit<MinimalPageProps, "variant">) => {
  return (
    <PFPage isContentFilled masthead={<Masthead />}>
      <PageGroup tabIndex={-1} id="main-content">
        {children}
      </PageGroup>
    </PFPage>
  );
};

/**
 * Standard page layout with header, optional progress tracking, and optional
 * qestions rendering.
 *
 * It also composes the header's trailing content shared by every standard
 * page: any page-specific content first, followed by the default tools (the
 * localization selector, the progress status monitor, the appearance settings,
 * and the installer options menu).
 */
const StandardLayout = ({
  progress,
  children,
  showQuestions = true,
  additionalContent,
  noDefaultProgressMonitor = false,
  showL10nValues = false,
  ...headerProps
}: Omit<StandardPageProps, "variant">) => {
  const location = useLocation();

  // Changing the product or mode makes no sense on the product selection page
  // itself nor during/after the installation.
  const showChangeProductOption = ![
    PRODUCT.changeProduct,
    ROOT.installation,
    ROOT.installationProgress,
    ROOT.installationFinished,
    ROOT.installationExit,
  ].includes(location.pathname);

  const headerContent = (
    <>
      {additionalContent}
      {!noDefaultProgressMonitor && <ProgressStatusMonitor />}
      <InstallerL10nOptions showValues={showL10nValues} />
      <AppearanceSettings />
      <InstallerOptionsMenu hideLabel showChangeProductOption={showChangeProductOption} />
    </>
  );

  return (
    <PFPage
      isContentFilled
      masthead={<Header {...headerProps} additionalContent={headerContent} />}
    >
      <Suspense fallback={<Loading />}>
        <PageGroup tabIndex={-1} id="main-content">
          {children || <Outlet />}
          {progress && <ProgressBackdrop {...progress} />}
        </PageGroup>
      </Suspense>
      {showQuestions && <Questions />}
    </PFPage>
  );
};

/**
 * Root container for Agama pages.
 *
 * Built on top of PatternFly's Page/PageGroup components, it provides a
 * consistent layout structure with optional header, breadcrumbs, and progress
 * tracking capabilities.
 *
 * @see {@link https://www.patternfly.org/components/page | PatternFly Page}
 *
 * @example
 * Standard page with header and breadcrumbs
 * ```tsx
 * <Page title="Software" breadcrumbs={<Breadcrumbs />}>
 *   <Page.Section>
 *     <SoftwareContent />
 *   </Page.Section>
 * </Page>
 * ```
 *
 * @example
 * Page with progress tracking
 * ```tsx
 * <Page
 *   title="Software"
 *   progress={{
 *     scope: "software",
 *     awaitQueriesRefetch: [PROPOSAL_QUERY_KEY, EXTENDED_CONFIG_QUERY_KEY]
 *   }}
 * >
 *   <Page.Section>
 *     <PatternSelector />
 *   </Page.Section>
 * </Page>
 * ```
 *
 * @example
 * Page with installer options in header
 * ```tsx
 * <Page title="Overview" showInstallerOptions>
 *   <OverviewContent />
 * </Page>
 * ```
 *
 * @example
 * Page without Questions component (e.g., login or exit pages)
 * ```tsx
 * <Page title="Login" showQuestions={false}>
 *   <LoginForm />
 * </Page>
 * ```
 *
 * @example
 * Minimal layout without header (e.g., for login)
 * ```tsx
 * <Page variant="minimal">
 *   <LoginForm />
 * </Page>
 * ```
 */
const Page = (props: PageProps): React.ReactNode => {
  if (props.variant === "minimal") {
    return <MinimalLayout>{props.children}</MinimalLayout>;
  }

  const { variant, ...standardProps } = props;
  return <StandardLayout {...standardProps} />;
};

Page.displayName = "agama/core/Page";
Page.Content = Content;
Page.Back = Back;
Page.Cancel = Cancel;
Page.Submit = Submit;
Page.Section = Section;

export default Page;
