import { render } from "@testing-library/react";

import { InstallerClientProvider } from "./context/installer";
import InstallerClient from "./lib/InstallerClient";

const InstallerProvider =
  client =>
  ({ children }) =>
    (
      <InstallerClientProvider client={client}>
        {children}
      </InstallerClientProvider>
    );

const customRender = (ui, options = {}) => {
  let client = options.installerClient || new InstallerClient();
  return render(ui, { wrapper: InstallerProvider(client), ...options });
};

export { customRender as render };
