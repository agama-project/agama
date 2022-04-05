import React, { StrictMode } from "react";
import { InstallerClientProvider } from "./context/installer";
import { AuthProvider } from "./context/auth";
import { createClient } from "./lib/client";

import "./patternfly.scss";
import "@fontsource/lato/400.css";
import "@fontsource/lato/400-italic.css";
import "@fontsource/lato/700.css";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/500.css";
import "@fontsource/roboto-mono/400.css";
import "./app.scss";

const client = createClient();

export const ScreenshotsWrapper = ({ children }) => (
  <StrictMode>
    <InstallerClientProvider client={client}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </InstallerClientProvider>
  </StrictMode>
);
