# ***************************************************************************
#
# Copyright (c) 2002 - 2012 Novell, Inc.
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File:  modules/GPG.ycp
# Package:  yast2
# Summary:  A wrapper for gpg binary
# Authors:  Ladislav Slezak <lslezak@suse.cz>
#
# $Id$
#
# This module provides GPG key related functions. It is a wrapper around gpg
# binary. It uses caching for reading GPG keys from the keyrings.
require "yast"
require "shellwords"

module Yast
  class GPGClass < Module
    def main
      Yast.import "UI"

      Yast.import "String"
      Yast.import "Report"
      Yast.import "FileUtils"

      textdomain "base"

      # value for --homedir gpg option, empty string means default home directory
      @home = ""

      # key cache
      @public_keys = nil
      # key cache
      @private_keys = nil

      # Map for parsing gpg output. Key is regexp, value is the key returned
      # in the result of the parsing.
      @parsing_map = {
        # secret key ID
        "^sec  .*/([^ ]*) "             => "id",
        # public key id
        "^pub  .*/([^ ]*) "             => "id",
        # user id
        "^uid *(.*)"                    => "uid",
        # fingerprint
        "^      Key fingerprint = (.*)" => "fingerprint"
      }
    end

    # Build GPG option string
    # @param [String] options additional gpg options
    # @return [String] gpg option string
    def buildGPGcommand(options)
      home_opt = @home.empty? ? "" : "--homedir '#{String.Quote(@home)}' "
      ret = "/usr/bin/gpg #{home_opt} #{options}"
      Builtins.y2milestone("gpg command: %1", ret)

      ret
    end

    # Execute gpg with the specified parameters, --homedir is added to the options
    # @param [String] options additional gpg options
    # @return [Hash] result of the execution
    def callGPG(options)
      command = "LC_ALL=en_US.UTF-8 " + buildGPGcommand(options)

      ret = Convert.to_map(SCR.Execute(path(".target.bash_output"), command))

      Builtins.y2error("gpg error: %1", ret) if Ops.get_integer(ret, "exit", -1) != 0

      deep_copy(ret)
    end

    XTERM_PATH = "/usr/bin/xterm".freeze

    # Decrypts file with symmetric cipher.
    # @param [String] file encrypted file
    # @param [String] password to use
    # @return [String] decrypted content of file
    # @raise [GPGFailed] when decryption failed
    def decrypt_symmetric(file, password)
      out = callGPG("--decrypt --batch --passphrase '#{String.Quote(password)}' '#{String.Quote(file)}'")

      raise GPGFailed, out["stderr"] if out["exit"] != 0

      out["stdout"]
    end

    # @return [Boolean] if file is gpg symmetric encrypted with --armor
    def encrypted_symmetric?(file)
      File.readlines(file).first&.strip == "-----BEGIN PGP MESSAGE-----"
    end

    # Encrypts file with symmetric cipher.
    # @param [String] input_file file to encrypt
    # @param [String] output_file where result is written
    # @param [String] password to use
    # @return [void]
    # @note exception is raised even if file exist
    # @raise [GPGFailed] when encryption failed
    def encrypt_symmetric(input_file, output_file, password)
      out = callGPG("--armor --batch --symmetric --passphrase '#{String.Quote(password)}' " \
                    "--output '#{String.Quote(output_file)}' '#{String.Quote(input_file)}'")

      raise GPGFailed, out["stderr"] if out["exit"] != 0
    end

  end

  # Exception raised when GPG failed
  # @note not all methods in GPG module use this exception
  class GPGFailed < RuntimeError
  end

  GPG = GPGClass.new
  GPG.main
end
