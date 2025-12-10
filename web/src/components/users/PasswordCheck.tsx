/*
 * Copyright (c) [2025] SUSE LLC
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

import React, { useEffect, useState } from "react";
import SmallWarning from "~/components/core/SmallWarning";
import { checkPassword } from "~/model/users";
import { _ } from "~/i18n";

const MINIMAL_SCORE = 50;

const PasswordCheck = ({ password }: { password: string }) => {
  const [error, setError] = useState("");

  useEffect(() => {
    if (!password) return;

    checkPassword(password).then((result) => {
      if (result.failure) {
        setError(result.failure);
      } else if (result.success && result.success < MINIMAL_SCORE) {
        setError(_("The password is weak"));
      } else {
        setError("");
      }
    });
  }, [password]);

  if (!error) return;

  return (
    <div aria-live="polite">
      <SmallWarning text={error} />
    </div>
  );
};

export default PasswordCheck;
