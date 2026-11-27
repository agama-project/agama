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

import React, { useEffect, useRef } from "react";
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

/** The summary sentence, with the count and any data loss in brackets. */
function sentence(count: number, isLossy: boolean): string {
  return sprintf(
    isLossy
      ? n_(
          // TRANSLATORS: %d is the number of actions. Keep the square brackets: their text is shown
          // in bold.
          "Applying the configuration will take [%d action] during final installation, [with potential data loss].",
          "Applying the configuration will take [%d actions] during final installation, [with potential data loss].",
          count,
        )
      : n_(
          // TRANSLATORS: %d is the number of actions. Keep the square brackets: their text is shown
          // in bold.
          "Applying the configuration will take [%d action] during final installation, with no expected data loss.",
          "Applying the configuration will take [%d actions] during final installation, with no expected data loss.",
          count,
        ),
    count,
  );
}

/**
 * Announces when the setup starts or stops losing data, and once when the
 * planned changes differ from the last reviewed ones. Changes of the count
 * alone are not announced, since nearly every setting changes it.
 */
function useAnnounceChanges(isLossy: boolean, hasUnseenChanges: boolean, summary: string) {
  const announce = useAnnounce();
  const wasLossy = useRef(isLossy);
  const hadUnseenChanges = useRef(hasUnseenChanges);

  useEffect(() => {
    const parts: string[] = [];

    if (wasLossy.current !== isLossy) parts.push(summary);
    if (hasUnseenChanges && !hadUnseenChanges.current) {
      // TRANSLATORS: read by screen readers when the planned storage changes differ from the ones
      // last reviewed
      parts.push(_("The planned changes are different since you last reviewed them."));
    }

    wasLossy.current = isLossy;
    hadUnseenChanges.current = hasUnseenChanges;
    if (parts.length) announce(parts.join(" ") as TranslatedString);
  }, [isLossy, hasUnseenChanges, summary, announce]);
}

/**
 * The summary of the planned storage changes, with a button to see them in
 * full. Plain text rather than an alert, with only the count and any data loss
 * in bold.
 */
export default function Summary(): React.ReactNode {
  const actions = useActions();

  const isLossy = losesData(actions);
  const title = sentence(actions.length, isLossy);

  const { hasUnseenChanges } = useUnseenChanges();

  useAnnounceChanges(isLossy, hasUnseenChanges, markerText(title));

  return (
    <p>
      <Marked sentence={title} /> <Consequences />
    </p>
  );
}
