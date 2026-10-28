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

import {
  AuthMode,
  defaultOptions,
  isPrivateKey,
  isValidSshKey,
  validate,
  UserFormFields,
  RootFormFields,
} from "./fields";

// Test helper to create form field objects
const createFormFields = (
  user: Partial<UserFormFields> = {},
  root: Partial<RootFormFields> = {},
) => ({
  ...defaultOptions.defaultValues,
  ...user,
  ...root,
});

describe("authentication form fields", () => {
  describe("defaultOptions", () => {
    it("provides correct default values", () => {
      expect(defaultOptions.defaultValues).toEqual({
        defineUser: false,
        userFullName: "",
        userName: "",
        usernameSuggestions: [],
        userPassword: "",
        userPasswordConfirmation: "",
        userUsingHashedPassword: false,
        userSshPublicKeys: [],
        rootAuthMode: AuthMode.NONE,
        rootPassword: "",
        rootPasswordConfirmation: "",
        rootUsingHashedPassword: false,
        rootSshPublicKeys: [],
      });
    });
  });

  describe("SSH key validation helpers", () => {
    describe("isValidSshKey", () => {
      it("accepts valid SSH RSA keys", () => {
        expect(isValidSshKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host")).toBe(true);
      });

      it("accepts valid SSH ED25519 keys", () => {
        expect(isValidSshKey("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm user@host")).toBe(
          true,
        );
      });

      it("accepts valid ECDSA keys", () => {
        expect(
          isValidSshKey("ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTY= user@host"),
        ).toBe(true);
      });

      it("accepts SSH keys without comment", () => {
        expect(isValidSshKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA")).toBe(true);
      });

      it("rejects invalid format", () => {
        expect(isValidSshKey("not a valid ssh key")).toBe(false);
      });

      it("rejects empty string", () => {
        expect(isValidSshKey("")).toBe(false);
      });
    });

    describe("isPrivateKey", () => {
      it("detects private keys", () => {
        expect(isPrivateKey("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
        expect(isPrivateKey("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe(true);
      });

      it("returns false for public keys", () => {
        expect(isPrivateKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host")).toBe(false);
      });
    });
  });

  describe("validate", () => {
    describe("when user is not defined", () => {
      it("returns no errors for minimal valid form", () => {
        const result = validate(createFormFields());
        expect(result).toBeUndefined();
      });
    });

    describe("when user is defined", () => {
      it("requires full name", () => {
        const result = validate(
          createFormFields({
            defineUser: true,
            userName: "jdoe",
            userPassword: "secret123",
            userPasswordConfirmation: "secret123",
          }),
        );
        expect(result?.fields?.userFullName).toBeDefined();
      });

      it("requires username", () => {
        const result = validate(
          createFormFields({
            defineUser: true,
            userFullName: "John Doe",
            userPassword: "secret123",
            userPasswordConfirmation: "secret123",
          }),
        );
        expect(result?.fields?.userName).toBeDefined();
      });

      it("requires password when not using hashed password", () => {
        const result = validate(
          createFormFields({
            defineUser: true,
            userFullName: "John Doe",
            userName: "jdoe",
            userPasswordConfirmation: "secret123",
          }),
        );
        expect(result?.fields?.userPassword).toBeDefined();
      });

      it("requires password confirmation when not using hashed password", () => {
        const result = validate(
          createFormFields({
            defineUser: true,
            userFullName: "John Doe",
            userName: "jdoe",
            userPassword: "secret123",
          }),
        );
        expect(result?.fields?.userPasswordConfirmation).toBeDefined();
      });

      it("validates that passwords match", () => {
        const result = validate(
          createFormFields({
            defineUser: true,
            userFullName: "John Doe",
            userName: "jdoe",
            userPassword: "secret123",
            userPasswordConfirmation: "different456",
          }),
        );
        expect(result?.fields?.userPasswordConfirmation).toContain("do not match");
      });

      it("does not require password when using hashed password", () => {
        const result = validate(
          createFormFields({
            defineUser: true,
            userFullName: "John Doe",
            userName: "jdoe",
            userUsingHashedPassword: true,
          }),
        );
        expect(result).toBeUndefined();
      });

      it("accepts valid form with all fields", () => {
        const result = validate(
          createFormFields({
            defineUser: true,
            userFullName: "John Doe",
            userName: "jdoe",
            userPassword: "secret123",
            userPasswordConfirmation: "secret123",
            userSshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
          }),
        );
        expect(result).toBeUndefined();
      });
    });

    describe("root authentication", () => {
      describe("when authMode is NONE", () => {
        it("returns no errors", () => {
          const result = validate(createFormFields());
          expect(result).toBeUndefined();
        });
      });

      describe("when authMode is PASSWORD", () => {
        it("requires password when not using hashed password", () => {
          const result = validate(
            createFormFields(
              {},
              { rootAuthMode: AuthMode.PASSWORD, rootPasswordConfirmation: "secret123" },
            ),
          );
          expect(result?.fields?.rootPassword).toBeDefined();
        });

        it("requires password confirmation when not using hashed password", () => {
          const result = validate(
            createFormFields({}, { rootAuthMode: AuthMode.PASSWORD, rootPassword: "secret123" }),
          );
          expect(result?.fields?.rootPasswordConfirmation).toBeDefined();
        });

        it("validates that passwords match", () => {
          const result = validate(
            createFormFields(
              {},
              {
                rootAuthMode: AuthMode.PASSWORD,
                rootPassword: "secret123",
                rootPasswordConfirmation: "different456",
              },
            ),
          );
          expect(result?.fields?.rootPasswordConfirmation).toContain("do not match");
        });

        it("does not require password when using hashed password", () => {
          const result = validate(
            createFormFields(
              {},
              { rootAuthMode: AuthMode.PASSWORD, rootUsingHashedPassword: true },
            ),
          );
          expect(result).toBeUndefined();
        });

        it("accepts valid password form", () => {
          const result = validate(
            createFormFields(
              {},
              {
                rootAuthMode: AuthMode.PASSWORD,
                rootPassword: "secret123",
                rootPasswordConfirmation: "secret123",
              },
            ),
          );
          expect(result).toBeUndefined();
        });
      });

      describe("when authMode is SSH_KEY", () => {
        it("requires at least one SSH key", () => {
          const result = validate(createFormFields({}, { rootAuthMode: AuthMode.SSH_KEY }));
          expect(result?.fields?.rootSshPublicKeys).toContain("At least one");
        });

        it("validates SSH key format", () => {
          const result = validate(
            createFormFields(
              {},
              { rootAuthMode: AuthMode.SSH_KEY, rootSshPublicKeys: ["invalid key format"] },
            ),
          );
          expect(result?.fields?.rootSshPublicKeys).toContain("invalid");
        });

        it("rejects private keys", () => {
          const result = validate(
            createFormFields(
              {},
              {
                rootAuthMode: AuthMode.SSH_KEY,
                rootSshPublicKeys: ["-----BEGIN RSA PRIVATE KEY-----"],
              },
            ),
          );
          expect(result?.fields?.rootSshPublicKeys).toContain("invalid");
        });

        it("accepts valid SSH keys", () => {
          const result = validate(
            createFormFields(
              {},
              {
                rootAuthMode: AuthMode.SSH_KEY,
                rootSshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
              },
            ),
          );
          expect(result).toBeUndefined();
        });
      });

      describe("when authMode is BOTH", () => {
        it("requires both password and SSH key", () => {
          const result = validate(createFormFields({}, { rootAuthMode: AuthMode.BOTH }));
          expect(result?.fields?.rootPassword).toBeDefined();
          expect(result?.fields?.rootSshPublicKeys).toBeDefined();
        });

        it("accepts valid form with both password and SSH key", () => {
          const result = validate(
            createFormFields(
              {},
              {
                rootAuthMode: AuthMode.BOTH,
                rootPassword: "secret123",
                rootPasswordConfirmation: "secret123",
                rootSshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
              },
            ),
          );
          expect(result).toBeUndefined();
        });
      });
    });

    describe("combined user and root validation", () => {
      it("validates both sections independently", () => {
        const result = validate(
          createFormFields(
            {
              defineUser: true,
              userName: "jdoe",
              userPassword: "secret123",
              userPasswordConfirmation: "secret123",
            },
            {
              rootAuthMode: AuthMode.PASSWORD,
              rootPasswordConfirmation: "rootpass",
            },
          ),
        );

        expect(result?.fields?.userFullName).toBeDefined();
        expect(result?.fields?.rootPassword).toBeDefined();
      });

      it("accepts valid form with both user and root defined", () => {
        const result = validate(
          createFormFields(
            {
              defineUser: true,
              userFullName: "John Doe",
              userName: "jdoe",
              userPassword: "secret123",
              userPasswordConfirmation: "secret123",
              userSshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
            },
            {
              rootAuthMode: AuthMode.BOTH,
              rootPassword: "rootpass",
              rootPasswordConfirmation: "rootpass",
              rootSshPublicKeys: ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm root@host"],
            },
          ),
        );

        expect(result).toBeUndefined();
      });
    });
  });
});
