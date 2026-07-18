import React from "react";
import { Title } from "@patternfly/react-core";
import Icon, { IconProps } from "./Icon";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import type { TranslatedString } from "~/i18n";

/**
 * Text shown to the user: a translated string, or a React element whose
 * rendered content is already translated. Plain untranslated strings are
 * rejected on purpose.
 */
type TextContent = TranslatedString | React.ReactElement;

export type SplitInfoLayoutProps = {
  /** Optional decorative icon rendered above the title. */
  icon?: IconProps["name"];

  /** Screen title, rendered as the level 1 heading. */
  title: TextContent;

  /** Supporting text rendered below the title. */
  description?: TextContent;
};

/**
 * Layout for standalone screens presenting a single focal composition: an
 * icon, a title, a short description, and one free-form piece of content
 * given as children (a button, a form, an alert).
 *
 * The markup keeps the story in reading order (icon, title, description,
 * content) at every viewport size. Small viewports render one centered
 * column. From the medium breakpoint up, icon, title, and description sit in
 * the start column and the content in the end column, with a vertical
 * divider between them; columns and alignment follow the document's writing
 * direction.
 *
 * @example
 * ```tsx
 * <SplitInfoLayout
 *   icon="error"
 *   title={_("Installation failed")}
 *   description={_("Review logs and try again.")}
 * >
 *   <Button>Reboot</Button>
 * </SplitInfoLayout>
 * ```
 */
export default function SplitInfoLayout({
  icon,
  title,
  description,
  children,
}: React.PropsWithChildren<SplitInfoLayoutProps>) {
  return (
    <div className="agm-split-info-layout">
      {icon && (
        <div className="agm-split-info-layout__icon">
          <Icon name={icon} size="4xl" />
        </div>
      )}
      <Title
        headingLevel="h1"
        className={["agm-split-info-layout__title", textStyles.fontSize_3xl, "text-balance"].join(
          " ",
        )}
      >
        {title}
      </Title>
      {description && <div className="agm-split-info-layout__description">{description}</div>}
      {children && <div className="agm-split-info-layout__content">{children}</div>}
      <div className="agm-split-info-layout__divider" />
    </div>
  );
}
