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

import React, { useEffect } from "react";
import { useAuthContext } from "./context/auth";

import LoadingEnvironment from "./LoadingEnvironment";
import LoginForm from "./LoginForm";
import Installer from "./Installer";

import "@fontsource/lato/400.css";
import "@fontsource/lato/400-italic.css";
import "@fontsource/lato/700.css";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/500.css";
import "@fontsource/roboto-mono/400.css";
import "./app.scss";

function App() {
  const {
    state: { loggedIn },
    autoLogin
  } = useAuthContext();

  useEffect(autoLogin, []);

  if (loggedIn === null) return <LoadingEnvironment />;
  return loggedIn ? <Installer /> : <LoginForm />;
}

export default App;
