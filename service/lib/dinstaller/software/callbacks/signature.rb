# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "dinstaller/can_ask_question"
require "dinstaller/question"

Yast.import "Pkg"

module DInstaller
  module Software
    module Callbacks
      # Callbacks related to signatures handling
      class Signature
        include CanAskQuestion

        # @param questions_manager [DBus::Clients::QuestionsManager]
        # @param logger [Logger]
        def initialize(questions_manager, logger)
          @questions_manager = questions_manager
          @logger = logger
        end

        # Register the callbacks
        def setup
          Yast::Pkg.CallbackAcceptUnsignedFile(
            Yast::FunRef.new(method(:accept_unsigned_file), "boolean (string, integer)")
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
              "The file %{filename} from repository %{repo_name} (%{repo_url})",
              filename: filename, repo_name: repo["name"], repo_url: repo["url"]
            )
          else
            format("The file %{filename}", filename: filename)
          end

          message = format(
            "%{source} is not digitally signed. The origin and integrity of the file cannot be "\
            "verified. Use it anyway?", source: source
          )

          question = DInstaller::Question.new(
            message, options: [:Yes, :No], default_option: :No
          )
          ask(question) do |q|
            logger.info "#{q.text} #{q.answer}"
            q.answer == :Yes
          end
        end

      private

        # @return [DBus::Clients::QuestionsManager]
        attr_reader :questions_manager

        # @return [Logger]
        attr_reader :logger
      end
    end
  end
end
