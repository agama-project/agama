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

export type SideBySideLayoutProps = {
  /** Optional decorative icon rendered above the title. */
  icon?: IconProps["name"];

  /** Screen title, rendered as the level 1 heading. */
  title: TextContent;

  /** Supporting text rendered below the title. */
  description?: TextContent;
};

/**
 * Layout pairing an icon, a title, and a short description with one
 * free-form piece of content given as children (a button, a form, an
 * alert).
 *
 * The markup keeps the story in reading order (icon, title, description,
 * content) at every viewport size. Small viewports render one centered
 * column. From the medium breakpoint up, icon, title, and description sit in
 * the start column and the content in the end column, with a vertical
 * divider between them; columns and alignment follow the document's writing
 * direction. Title and description share a single row with the body instead
 * of each getting a row of their own, so their position stays predictable no
 * matter how tall the body is. The body's top edge is nudged down so the
 * title (a heading) and the body's opening line read as paired despite their
 * different sizes.
 *
 * @example
 * ```tsx
 * <SideBySideLayout
 *   icon="error"
 *   title={_("Installation failed")}
 *   description={_("Review logs and try again.")}
 * >
 *   <Button>Reboot</Button>
 * </SideBySideLayout>
 * ```
 */
export default function SideBySideLayout({
  icon,
  title,
  description,
  children,
}: React.PropsWithChildren<SideBySideLayoutProps>) {
  return (
    <div className="agm-side-by-side-layout">
      {icon && (
        <div className="agm-side-by-side-layout__icon">
          <Icon name={icon} size="4xl" />
        </div>
      )}
      <div className="agm-side-by-side-layout__intro">
        <Title
          headingLevel="h1"
          className={[
            "agm-side-by-side-layout__title",
            textStyles.fontSize_3xl,
            "text-balance",
          ].join(" ")}
        >
          {title}
        </Title>
        {description && <div className="agm-side-by-side-layout__description">{description}</div>}
      </div>
      {children && <div className="agm-side-by-side-layout__body">{children}</div>}
      <div className="agm-side-by-side-layout__divider" />
    </div>
  );
}
