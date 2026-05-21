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

import { AuthMode, defaultOptions, isPrivateKey, isValidSshKey, validate } from "./fields";

describe("authentication form fields", () => {
  describe("defaultOptions", () => {
    it("provides correct default values", () => {
      expect(defaultOptions.defaultValues).toEqual({
        firstUser: {
          define: false,
          fullName: "",
          userName: "",
          usernameSuggestions: [],
          password: "",
          passwordConfirmation: "",
          usingHashedPassword: false,
          sshPublicKeys: [],
        },
        root: {
          authMode: AuthMode.NONE,
          password: "",
          passwordConfirmation: "",
          usingHashedPassword: false,
          sshPublicKeys: [],
        },
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
    describe("when first user is not defined", () => {
      it("returns no errors for minimal valid form", () => {
        const result = validate({
          firstUser: {
            define: false,
            fullName: "",
            userName: "",
            usernameSuggestions: [],
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
          root: {
            authMode: AuthMode.NONE,
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result).toBeUndefined();
      });
    });

    describe("when first user is defined", () => {
      it("requires full name", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "",
            userName: "jdoe",
            usernameSuggestions: [],
            password: "secret123",
            passwordConfirmation: "secret123",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
          root: {
            authMode: AuthMode.NONE,
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result?.fields?.["firstUser.fullName"]).toBeDefined();
      });

      it("requires username", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "John Doe",
            userName: "",
            usernameSuggestions: [],
            password: "secret123",
            passwordConfirmation: "secret123",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
          root: {
            authMode: AuthMode.NONE,
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result?.fields?.["firstUser.userName"]).toBeDefined();
      });

      it("requires password when not using hashed password", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "John Doe",
            userName: "jdoe",
            usernameSuggestions: [],
            password: "",
            passwordConfirmation: "secret123",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
          root: {
            authMode: AuthMode.NONE,
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result?.fields?.["firstUser.password"]).toBeDefined();
      });

      it("requires password confirmation when not using hashed password", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "John Doe",
            userName: "jdoe",
            usernameSuggestions: [],
            password: "secret123",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
          root: {
            authMode: AuthMode.NONE,
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result?.fields?.["firstUser.passwordConfirmation"]).toBeDefined();
      });

      it("validates that passwords match", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "John Doe",
            userName: "jdoe",
            usernameSuggestions: [],
            password: "secret123",
            passwordConfirmation: "different456",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
          root: {
            authMode: AuthMode.NONE,
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result?.fields?.["firstUser.passwordConfirmation"]).toContain("do not match");
      });

      it("does not require password when using hashed password", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "John Doe",
            userName: "jdoe",
            usernameSuggestions: [],
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: true,
            sshPublicKeys: [],
          },
          root: {
            authMode: AuthMode.NONE,
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result).toBeUndefined();
      });

      it("accepts valid form with all fields", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "John Doe",
            userName: "jdoe",
            usernameSuggestions: [],
            password: "secret123",
            passwordConfirmation: "secret123",
            usingHashedPassword: false,
            sshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
          },
          root: {
            authMode: AuthMode.NONE,
            password: "",
            passwordConfirmation: "",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result).toBeUndefined();
      });
    });

    describe("root authentication", () => {
      describe("when authMode is NONE", () => {
        it("returns no errors", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.NONE,
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
          });

          expect(result).toBeUndefined();
        });
      });

      describe("when authMode is PASSWORD", () => {
        it("requires password when not using hashed password", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.PASSWORD,
              password: "",
              passwordConfirmation: "secret123",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
          });

          expect(result?.fields?.["root.password"]).toBeDefined();
        });

        it("requires password confirmation when not using hashed password", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.PASSWORD,
              password: "secret123",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
          });

          expect(result?.fields?.["root.passwordConfirmation"]).toBeDefined();
        });

        it("validates that passwords match", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.PASSWORD,
              password: "secret123",
              passwordConfirmation: "different456",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
          });

          expect(result?.fields?.["root.passwordConfirmation"]).toContain("do not match");
        });

        it("does not require password when using hashed password", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.PASSWORD,
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: true,
              sshPublicKeys: [],
            },
          });

          expect(result).toBeUndefined();
        });

        it("accepts valid password form", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.PASSWORD,
              password: "secret123",
              passwordConfirmation: "secret123",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
          });

          expect(result).toBeUndefined();
        });
      });

      describe("when authMode is SSH_KEY", () => {
        it("requires at least one SSH key", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.SSH_KEY,
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
          });

          expect(result?.fields?.["root.sshPublicKeys"]).toContain("At least one");
        });

        it("validates SSH key format", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.SSH_KEY,
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: ["invalid key format"],
            },
          });

          expect(result?.fields?.["root.sshPublicKeys"]).toContain("invalid");
        });

        it("rejects private keys", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.SSH_KEY,
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: ["-----BEGIN RSA PRIVATE KEY-----"],
            },
          });

          expect(result?.fields?.["root.sshPublicKeys"]).toContain("invalid");
        });

        it("accepts valid SSH keys", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.SSH_KEY,
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
            },
          });

          expect(result).toBeUndefined();
        });
      });

      describe("when authMode is BOTH", () => {
        it("requires both password and SSH key", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.BOTH,
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
          });

          expect(result?.fields?.["root.password"]).toBeDefined();
          expect(result?.fields?.["root.sshPublicKeys"]).toBeDefined();
        });

        it("accepts valid form with both password and SSH key", () => {
          const result = validate({
            firstUser: {
              define: false,
              fullName: "",
              userName: "",
              usernameSuggestions: [],
              password: "",
              passwordConfirmation: "",
              usingHashedPassword: false,
              sshPublicKeys: [],
            },
            root: {
              authMode: AuthMode.BOTH,
              password: "secret123",
              passwordConfirmation: "secret123",
              usingHashedPassword: false,
              sshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
            },
          });

          expect(result).toBeUndefined();
        });
      });
    });

    describe("combined first user and root validation", () => {
      it("validates both sections independently", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "",
            userName: "jdoe",
            usernameSuggestions: [],
            password: "secret123",
            passwordConfirmation: "secret123",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
          root: {
            authMode: AuthMode.PASSWORD,
            password: "",
            passwordConfirmation: "rootpass",
            usingHashedPassword: false,
            sshPublicKeys: [],
          },
        });

        expect(result?.fields?.["firstUser.fullName"]).toBeDefined();
        expect(result?.fields?.["root.password"]).toBeDefined();
      });

      it("accepts valid form with both first user and root defined", () => {
        const result = validate({
          firstUser: {
            define: true,
            fullName: "John Doe",
            userName: "jdoe",
            usernameSuggestions: [],
            password: "secret123",
            passwordConfirmation: "secret123",
            usingHashedPassword: false,
            sshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
          },
          root: {
            authMode: AuthMode.BOTH,
            password: "rootpass",
            passwordConfirmation: "rootpass",
            usingHashedPassword: false,
            sshPublicKeys: ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm root@host"],
          },
        });

        expect(result).toBeUndefined();
      });
    });
  });
});
