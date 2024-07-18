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
        question = {
          # TODO: id for newly created question is ignored, but maybe it will
          # be better to not have to specify it at all?
          id:             0,
          class:          "autoyast.popup",
          text:           text,
          options:        generate_options(buttons),
          default_option: focus || options.first,
          data:           {}
        }
        data = { generic: question }.to_json
        answer_json = Yast::Execute.locally!("agama", "questions", "ask",
          stdin: data, stdout: :capture)
        answer = JSON.parse!(answer_json)
        answer["generic"]["answer"].to_sym
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
      # at first construct agama question to display.
      text = @label
      question = {
        # TODO: id for newly created question is ignored, but maybe it will
        # be better to not have to specify it at all?
        "id"            => 0,
        "class"         => "autoyast.password",
        "text"          => text,
        "options"       => ["ok", "cancel"],
        "defaultOption" => "cancel",
        "data"          => {}
      }
      data = { "generic" => question, "withPassword" => {} }.to_json
      answer_json = Yast::Execute.locally!("agama", "questions", "ask", stdin: data,
stdout: :capture)
      answer = JSON.parse!(answer_json)
      result = answer["generic"]["answer"].to_sym
      return nil if result == "cancel"

      answer["with_password"]["password"]
    end
  end
end

# rubocop:enable Metrics/ParameterLists
# rubocop:enable Lint/UnusedMethodArgument
