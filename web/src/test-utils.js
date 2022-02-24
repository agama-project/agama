import React from "react";
import { render } from "@testing-library/react";

import { InstallerClientProvider } from "./context/installer";
import { AuthProvider } from "./context/auth";
import InstallerClient from "./lib/InstallerClient";

const InstallerProvider = ({ children }) => {
  const client = new InstallerClient();
  return (
    <InstallerClientProvider client={client}>
      {children}
    </InstallerClientProvider>
  );
};

const AllProviders = ({ children }) => {
  return (
    <InstallerProvider>
      <AuthProvider>{children}</AuthProvider>
    </InstallerProvider>
  );
};

const installerRender = (ui, options = {}) => {
  return render(ui, { wrapper: InstallerProvider, ...options });
};

const authRender = (ui, options = {}) => {
  return render(ui, { wrapper: AllProviders, ...options });
};

export { installerRender, authRender };
