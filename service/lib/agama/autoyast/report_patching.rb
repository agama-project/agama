# frozen_string_literal: true

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

# Goal of this file is monkey patch Popup and Report functionality to not try to use UI
# and instead adapt it for agama needs.
# Do not directly require agama ruby files to be able to keep autoyast converter and agama
# independent.
# TODO: what to do if it runs without agama? Just print question to stderr?

require "json"
require "yast"
require "yast2/execute"
require "ui/dialog"
require "agama/question_with_password"
require "agama/http/clients/questions"

# :nodoc:
# rubocop:disable Metrics/ParameterLists
# rubocop:disable Lint/UnusedMethodArgument
module Yast2
  # :nodoc:
  class Popup
    class << self
      # Keep in sync with real Yast2::Popup
      def show(message, details: "", headline: "", timeout: 0, focus: nil,
        buttons: :ok, richtext: false, style: :notice)
        # at first construct agama question to display.
        # NOTE: timeout is not supported.
        # FIXME: what to do with richtext?
        text = message
        text += "\n\n" + details unless details.empty?
        options = generate_options(buttons)

        questions_client = Agama::HTTP::Clients::Questions.new(Logger.new($stdout))

        question = Agama::Question.new(
          qclass:         "autoyast.popup",
          text:           text,
          options:        generate_options(buttons),
          default_option: focus || options.first,
          data:           {}
        )

        questions_client.ask(question) do |answer|
          return answer.action
        end
      end

    private

      def generate_options(buttons)
        case buttons
        when :ok
          [:ok]
        when :continue_cancel
          [:continue, :cancel]
        when :yes_no
          [:yes, :no]
        when Hash
          buttons.keys
        else
          raise ArgumentError, "Invalid value #{buttons.inspect} for buttons"
        end
      end
    end
  end
end

# needed to ask for GPG encrypted autoyast profiles
# TODO: encrypt agama profile? is it needed?
module UI
  # :nodoc:
  class PasswordDialog < Dialog
    def new(label, confirm: false)
      @label = label
      # NOTE: implement confirm if needed
    end

    def run
      question = Agama::QuestionWithPassword.new(
        qclass:         "autoyast.password",
        text:           @label,
        options:        [:ok, :cancel],
        default_option: :cancel,
        data:           {}
      )

      questions_client = Agama::HTTP::Clients::Questions.new(Logger.new($stdout))

      questions_client.ask(question) do |answer|
        return nil if answer.action == :cancel

        return answer.value
      end
    end
  end
end

# rubocop:enable Metrics/ParameterLists
# rubocop:enable Lint/UnusedMethodArgument
