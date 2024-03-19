/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React, { useCallback, useEffect, useState } from "react";

const AuthContext = React.createContext(null);

/**
 * Returns the authentication functions
 */
function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a AuthProvider");
  }

  return context;
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.children] - content to display within the provider
 */
function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const login = useCallback(async (password) => {
    const response = await fetch("/api/auth", {
      method: "POST",
      body: JSON.stringify({ password }),
      headers: { "Content-Type": "application/json" },
    });
    const result = response.status === 200;
    setIsLoggedIn(result);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth", {
      method: "DELETE",
    });
    setIsLoggedIn(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth", {
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => {
        setIsLoggedIn(response.status === 200);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  return (
    <AuthContext.Provider value={{ login, logout, isLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthProvider, useAuth };
