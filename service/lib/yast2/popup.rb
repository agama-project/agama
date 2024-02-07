# frozen_string_literal: true

#
# Copyright (c) [2024] SUSE LLC
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
require "agama/dbus/clients/questions"

module Yast2
  # Replacement to the Yast2::Popup class to work with Agama.
  class Popup
    class << self
      # rubocop:disable Metrics/ParameterLists
      # rubocop:disable Lint/UnusedMethodArgument
      def show(message, details: "", headline: "", timeout: 0, focus: nil, buttons: :ok,
        richtext: false, style: :notice)

        question = Agama::Question.new(
          qclass:         "popup",
          text:           message,
          options:        generate_options(buttons),
          default_option: focus
        )
        questions_client.ask(question)
      end

    private

      # FIXME: inject the logger
      def logger
        @logger = Logger.new($stdout)
      end

      def generate_options(buttons)
        case buttons
        when :ok
          [:ok]
        when :continue_cancel
          [:continue, :cancel]
        when :yes_no
          [:yes, :no]
        else
          raise ArgumentError, "Invalid value #{buttons.inspect} for buttons"
        end
      end

      # Returns the client to ask questions
      #
      # @return [Agama::DBus::Clients::Questions]
      def questions_client
        @questions_client ||= Agama::DBus::Clients::Questions.new(logger: logger)
      end
    end
  end
end
# rubocop:enable Metrics/ParameterLists
# rubocop:enable Lint/UnusedMethodArgument
