/*
 * Copyright (c) [2026] SUSE LLC
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

import React from "react";
import { sprintf } from "sprintf-js";
import Interpolate, { markerText } from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import Consequences, { losesData } from "~/components/storage/storage-page/Consequences";
import { useUnseenChanges } from "~/components/storage/storage-page/use-unseen-changes";
import { useAnnounce } from "~/context/announcer";
import { useActions } from "~/hooks/model/proposal/storage";
import { _, n_ } from "~/i18n";
import type { TranslatedString } from "~/i18n";

const bold = (text: string) => <Text isBold>{text}</Text>;

/** Renders a sentence, its `[marked]` parts in bold. */
function Marked({ sentence }: { sentence: string }) {
  const count = [...sentence.matchAll(/\[[^[\]]*\]/g)].length;
  if (!count) return <>{sentence}</>;
  return <Interpolate sentence={sentence}>{Array(count).fill(bold)}</Interpolate>;
}

/**
 * The sentences of the summary: an optional first one, saying that nothing
 * happens yet, and the one about what happens later.
 *
 * Whatever is in square brackets is shown in bold: the count and "with data
 * loss", never "without data loss", which needs no emphasis.
 */
function sentence(count: number, isLossy: boolean): string {
  return sprintf(
    isLossy
      ? // TRANSLATORS: %d is the number of actions. Text in square brackets is shown in bold; keep the brackets.
        n_(
          "Applying the configuration will take [%d action] during final installation, [with potential data loss].",
          "Applying the configuration will take [%d actions] during final installation, [with potential data loss].",
          count,
        )
      : // TRANSLATORS: %d is the number of actions. Text in square brackets is shown in bold; keep the brackets.
        n_(
          "Applying the configuration will take [%d action] during final installation, with no expected data loss.",
          "Applying the configuration will take [%d actions] during final installation, with no expected data loss.",
          count,
        ),
    count,
  );
}

/**
 * Tells screen readers, in one polite message, what changed in the summary
 * that matters:
 *
 * - The setup starts or stops losing data: the summary is read.
 * - The planned changes become different from the ones last reviewed: a short
 *   notice says so, once, until they are reviewed again.
 *
 * The count alone is not announced: it changes with almost every setting,
 * and announcing it each time would talk over whatever the reader is doing.
 */
function useAnnounceChanges(isLossy: boolean, hasUnseenChanges: boolean, summary: string) {
  const announce = useAnnounce();
  const wasLossy = React.useRef(isLossy);
  const hadUnseenChanges = React.useRef(hasUnseenChanges);

  React.useEffect(() => {
    const parts: string[] = [];

    if (wasLossy.current !== isLossy) parts.push(summary);
    if (hasUnseenChanges && !hadUnseenChanges.current) {
      // TRANSLATORS: read by screen readers when the planned storage changes
      // differ from the ones the user last opened in "Preview result…".
      parts.push(_("The planned changes are different since you last reviewed them."));
    }

    wasLossy.current = isLossy;
    hadUnseenChanges.current = hasUnseenChanges;
    if (parts.length) announce(parts.join(" ") as TranslatedString);
  }, [isLossy, hasUnseenChanges, summary, announce]);
}

/**
 * The summary of what the installer will do to the disks, at the top of the
 * storage page, with the way to see it in full.
 *
 * Not a caution: it reports what the setup below leads to, so it reads as
 * plain text, with only the count and a data loss in bold. It changes with
 * every setting, which is what makes it worth glancing back at.
 */
export default function Summary(): React.ReactNode {
  const actions = useActions();

  const isLossy = losesData(actions);
  const title = sentence(actions.length, isLossy);

  const { hasUnseenChanges } = useUnseenChanges();

  useAnnounceChanges(isLossy, hasUnseenChanges, markerText(title));

  return (
    <div>
      <Marked sentence={title} /> <Consequences />
    </div>
  );
}
