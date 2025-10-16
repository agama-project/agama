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

# :nodoc:
module Agama
  module AutoYaST
    # Reports the problems found by the {ProfileChecker} using the questions client.
    class ProfileReporter
      include Yast::I18n

      # Constructor
      #
      # @param questions_client [Agama::HTTP::Clients::Questions]
      # @param logger [Logger]
      def initialize(questions_client, logger)
        textdomain "agama"

        @questions_client = questions_client
        @logger = logger
      end

      # Reports the problems and decide whether to continue or not.
      #
      # @param elements [Array<Element>] List of unsupported elements.
      def report(elements)
        keys = elements.map(&:key).join(", ")
        unsupported = elements.select { |e| e.support == :no }
        planned = elements.select { |e| e.support == :planned }

        message = format(
          _("Found unsupported elements in the AutoYaST profile: %{keys}."), keys: keys
        )
        question = Agama::Question.new(
          qclass:         "autoyast.unsupported",
          text:           message,
          options:        [:continue, :abort],
          default_option: :continue,
          data:           {
            "planned"     => planned.map(&:key).join(","),
            "unsupported" => unsupported.map(&:key).join(",")
          }
        )

        questions_client.ask(question) do |answer|
          answer == :continue
        end
      end

    private

      attr_reader :questions_client, :logger
    end
  end
end
