# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

Yast.import "Pkg"

module Agama
  module Software
    module Callbacks
      # Callbacks related to digest handling
      class Digest < Base
        def setup
          Yast::Pkg.CallbackAcceptFileWithoutChecksum(
            Yast::FunRef.new(
              method(:accept_file_without_checksum), "boolean (string)"
            )
          )
          Yast::Pkg.CallbackAcceptUnknownDigest(
            Yast::FunRef.new(
              method(:accept_unknown_digest), "boolean (string, string)"
            )
          )
          Yast::Pkg.CallbackAcceptWrongDigest(
            Yast::FunRef.new(
              method(:accept_wrong_digest), "boolean (string, string, string)"
            )
          )
        end

        # Callback to accept a file without a checksum
        #
        # @param filename [String] File name
        # @return [Boolean]
        def accept_file_without_checksum(filename)
          name = strip_download_prefix(filename)
          message = format(
            _(
              "No checksum for the file %{file} was found in the repository. This means that " \
              "although the file is part of the signed repository, the list of checksums " \
              "does not mention this file. Use it anyway?"
            ), file: name
          )

          question = Agama::Question.new(
            qclass:         "software.digest.no_digest",
            text:           message,
            options:        [yes_label.to_sym, no_label.to_sym],
            default_option: yes_label.to_sym
          )
          questions_client.ask(question) do |answer|
            answer.action == yes_label.to_sym
          end
        end

        # Callback to accept an unknown digest
        #
        # @param filename [String] File name
        # @param digest [String] expected checksum
        # @return [Boolean]
        def accept_unknown_digest(filename, digest)
          name = strip_download_prefix(filename)
          message = format(
            _(
              "The checksum of the file %{file} is \"%{digest}\" but the expected checksum is " \
              "unknown. This means that the origin and integrity of the file cannot be verified. " \
              "Use it anyway?"
            ), file: name, digest: digest
          )

          question = Agama::Question.new(
            qclass:         "software.digest.unknown_digest",
            text:           message,
            options:        [yes_label.to_sym, no_label.to_sym],
            default_option: yes_label.to_sym
          )
          questions_client.ask(question) do |answer|
            answer.action == yes_label.to_sym
          end
        end

        # Callback to accept wrong digest
        #
        # @param filename [String] File name
        # @param expected_digest [String] expected checksum
        # @param found_digest [String] found checksum
        # @return [Boolean]
        def accept_wrong_digest(filename, expected_digest, found_digest)
          name = strip_download_prefix(filename)
          message = format(
            _(
              "The expected checksum of file %{file} is \"%{found}\" but it was expected to be " \
              "\"%{expected}\". The file has changed by accident or by an attacker since the " \
              "creater signed it. Use it anyway?"
            ), file: name, found: found_digest, expected: expected_digest
          )

          question = Agama::Question.new(
            qclass:         "software.digest.unknown_digest",
            text:           message,
            options:        [yes_label.to_sym, no_label.to_sym],
            default_option: yes_label.to_sym
          )
          questions_client.ask(question) do |answer|
            answer.action == yes_label.to_sym
          end
        end

      private

        # helper to strip download path. It uses internal knowledge that download
        # prefix ends in TmpDir.* zypp location
        #
        # From https://github.com/yast/yast-yast2/blob/master/library/packages/src/modules/SignatureCheckDialogs.rb#L836
        def strip_download_prefix(path)
          path.sub(/\A\/.*\/TmpDir\.[^\/]+\//, "")
        end
      end
    end
  end
end
