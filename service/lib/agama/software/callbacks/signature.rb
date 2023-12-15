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

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # Callbacks related to signatures handling
      class Signature
        include Yast::I18n

        # Constructor
        #
        # @param questions_client [Agama::DBus::Clients::Questions]
        # @param logger [Logger]
        def initialize(questions_client, logger)
          textdomain "agama"

          @questions_client = questions_client
          @logger = logger
        end

        # Register the callbacks
        def setup
          Yast::Pkg.CallbackAcceptUnsignedFile(
            Yast::FunRef.new(method(:accept_unsigned_file), "boolean (string, integer)")
          )
          Yast::Pkg.CallbackImportGpgKey(
            Yast::FunRef.new(method(:import_gpg_key), "boolean (map <string, any>, integer)")
          )
        end

        # Callback to handle unsigned files
        #
        # @param filename [String] File name
        # @param repo_id [Integer] Repository ID. It might be -1 if there is not an associated repo.
        def accept_unsigned_file(filename, repo_id)
          repo = Yast::Pkg.SourceGeneralData(repo_id)
          source = if repo
            format(
              _("The file %{filename} from repository %{repo_name} (%{repo_url})"),
              filename: filename, repo_name: repo["name"], repo_url: repo["url"]
            )
          else
            format(_("The file %{filename}"), filename: filename)
          end

          message = format(
            _("%{source} is not digitally signed. The origin and integrity of the file cannot be " \
              "verified. Use it anyway?"), source: source
          )

          question = Agama::Question.new(
            qclass:         "software.unsigned_file",
            text:           message,
            options:        [:Yes, :No],
            default_option: :No,
            data:           { "filename" => filename }
          )
          questions_client.ask(question) do |question_client|
            question_client.answer == :Yes
          end
        end

        # Callback to handle signature verification failures
        #
        # @param key [Hash] GPG key data (id, name, fingerprint, etc.)
        # @param _repo_id [Integer] Repository ID
        def import_gpg_key(key, _repo_id)
          fingerprint = key["fingerprint"].scan(/.{4}/).join(" ")
          message = format(
            _("The key %{id} (%{name}) with fingerprint %{fingerprint} is unknown. " \
              "Do you want to trust this key?"),
            id: key["id"], name: key["name"], fingerprint: fingerprint
          )

          question = Agama::Question.new(
            qclass:         "software.import_gpg",
            text:           message,
            options:        [:Trust, :Skip],
            default_option: :Skip,
            data:           {
              "id"          => key["id"],
              "name"        => key["name"],
              "fingerprint" => fingerprint
            }
          )

          questions_client.ask(question) do |question_client|
            question_client.answer == :Trust
          end
        end

      private

        # @return [Agama::DBus::Clients::Questions]
        attr_reader :questions_client

        # @return [Logger]
        attr_reader :logger
      end
    end
  end
end
