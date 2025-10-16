# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "yast"
require "agama/question"
require "agama/software/callbacks/base"
require "agama/software/repositories_manager"

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # Callbacks related to signatures handling
      class Signature < Base
        # Register the callbacks
        def setup
          Yast::Pkg.CallbackAcceptUnsignedFile(
            Yast::FunRef.new(method(:accept_unsigned_file), "boolean (string, integer)")
          )
          Yast::Pkg.CallbackImportGpgKey(
            Yast::FunRef.new(method(:import_gpg_key), "boolean (map <string, any>, integer)")
          )
          Yast::Pkg.CallbackAcceptUnknownGpgKey(
            Yast::FunRef.new(
              method(:accept_unknown_gpg_key), "boolean (string, string, integer)"
            )
          )
          Yast::Pkg.CallbackAcceptVerificationFailed(
            Yast::FunRef.new(
              method(:accept_verification_failed), "boolean (string, map <string, any>, integer)"
            )
          )
        end

        # Callback to handle unsigned files
        #
        # @param filename [String] File name
        # @param repo_id [Integer] Repository ID. It might be -1 if there is not an associated repo.
        def accept_unsigned_file(filename, repo_id)
          repo = Yast::Pkg.SourceGeneralData(repo_id)
          if repo && Agama::Software::RepositoriesManager.instance.unsigned_allowed?(repo["alias"])
            return true
          end

          message = if repo
            format(
              _("The file %{filename} from %{repo_url} is not digitally signed. The origin " \
                "and integrity of the file cannot be verified. Use it anyway?"),
              filename: filename, repo_url: repo["url"]
            )
          else
            format(
              _("The file %{filename} is not digitally signed. The origin " \
                "and integrity of the file cannot be verified. Use it anyway?"),
              filename: filename
            )
          end

          question = Agama::Question.new(
            qclass:         "software.unsigned_file",
            text:           message,
            options:        [yes_label.to_sym, no_label.to_sym],
            default_option: no_label.to_sym,
            data:           { "filename" => filename }
          )
          questions_client.ask(question) do |answer|
            answer.action == yes_label.to_sym
          end
        end

        # Callback to handle signature verification failures
        #
        # @param key [Hash] GPG key data (id, name, fingerprint, etc.)
        # @param repo_id [Integer] Repository ID
        def import_gpg_key(key, repo_id)
          fingerprint = key["fingerprint"].scan(/.{4}/).join(" ")
          repo = Yast::Pkg.SourceGeneralData(repo_id)
          return true if repo && repo_manager.trust_gpg?(repo["alias"], fingerprint)

          message = format(
            _("The key %{id} (%{name}) with fingerprint %{fingerprint} is unknown. " \
              "Do you want to trust this key?"),
            id: key["id"], name: key["name"], fingerprint: fingerprint
          )

          question = Agama::Question.new(
            qclass:         "software.import_gpg",
            text:           message,
            options:        [trust_label.to_sym, skip_label.to_sym],
            default_option: skip_label.to_sym,
            data:           {
              "id"          => key["id"],
              "name"        => key["name"],
              "fingerprint" => fingerprint
            }
          )

          questions_client.ask(question) do |answer|
            answer.action == trust_label.to_sym
          end
        end

        # Callback to handle unknown GPG keys
        #
        # @param filename [String] Name of the file.
        # @param key_id [String] Key ID.
        # @param repo_id [String] Repository ID.
        def accept_unknown_gpg_key(filename, key_id, repo_id)
          repo = Yast::Pkg.SourceGeneralData(repo_id)
          message = if repo
            format(
              _("The file %{filename} from %{repo_url} is digitally signed with " \
                "the following unknown GnuPG key: %{key_id}. Use it anyway?"),
              filename: filename, repo_url: repo["url"], key_id: key_id
            )
          else
            format(
              _("The file %{filename} is digitally signed with " \
                "the following unknown GnuPG key: %{key_id}. Use it anyway?"),
              filename: filename, key_id: key_id
            )
          end

          question = Agama::Question.new(
            qclass:         "software.unknown_gpg",
            text:           message,
            options:        [yes_label.to_sym, no_label.to_sym],
            default_option: no_label.to_sym,
            data:           {
              "id"       => key_id,
              "filename" => filename
            }
          )

          questions_client.ask(question) do |answer|
            answer.action == yes_label.to_sym
          end
        end

        # Callback to handle file verification failures
        #
        # @param filename [String] File name
        # @param key [Hash] GPG key data (id, name, fingerprint, etc.)
        # @param repo_id [Integer] Repository ID
        def accept_verification_failed(filename, key, repo_id)
          repo = Yast::Pkg.SourceGeneralData(repo_id)
          message = if repo
            format(
              _("The file %{filename} from %{repo_url} is digitally signed with the " \
                "following GnuPG key, but the integrity check failed: %{key_id} (%{key_name}). " \
                "Use it anyway?"),
              filename: filename, repo_url: repo["url"], key_id: key["id"], key_name: key["name"]
            )
          else
            format(
              _("The file %{filename} is digitally signed with the " \
                "following GnuPG key, but the integrity check failed: %{key_id} (%{key_name}). " \
                "Use it anyway?"),
              filename: filename, key_id: key["id"], key_name: key["name"]
            )
          end

          question = Agama::Question.new(
            qclass:         "software.unsigned_file",
            text:           message,
            options:        [yes_label.to_sym, no_label.to_sym],
            default_option: no_label.to_sym,
            data:           { "filename" => filename }
          )
          questions_client.ask(question) do |answer|
            answer.action == yes_label.to_sym
          end
        end

      private

        # label for the "trust" action
        def trust_label
          # TRANSLATORS: button label, trust the GPG key or the signature
          _("Trust")
        end

        def repo_manager
          Agama::Software::RepositoriesManager.instance
        end
      end
    end
  end
end
