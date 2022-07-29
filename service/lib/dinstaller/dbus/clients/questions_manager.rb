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

require "dinstaller/dbus/clients/base"
require "dinstaller/dbus/clients/question"

module DInstaller
  module DBus
    module Clients
      # D-Bus client for asking a question.
      # It has the same interface as {DInstaller::QuestionsManager}
      # so it can be used for {DInstaller::CanAskQuestion}.
      class QuestionsManager < Base
        def initialize
          super

          @dbus_object = service["/org/opensuse/DInstaller/Questions1"]
          @dbus_object.default_iface = "org.opensuse.DInstaller.Questions1"
        end

        # @return [String]
        def service_name
          @service_name ||= "org.opensuse.DInstaller"
        end

        # Adds a question
        #
        # FIXME: I don't see a need for callbacks here. Keep them anyway?
        #
        # @param question [DInstaller::Question]
        # @return [DBus::Clients::Question] FIXME: I don't understand the concept of not asking a duplicate question
        def add(question)
          q_path = @dbus_object.New(
            question.text,
            question.options.map(&:to_s),
            Array(question.default_option&.to_s)
          )
          DBus::Clients::Question.new(q_path)
        end

        # Deletes the given question
        #
        # FIXME: I don't see a need for callbacks here. Keep them anyway?
        #
        # @param question [DBus::Clients::Question]
        # @return [void]
        def delete(question)
          @dbus_object.Delete(question.dbus_object.path)
        end

        # Waits until specified questions are answered.
        # @param questions [Array<DBus::Clients::Question>]
        # @return [void]
        def wait(questions)
          # so what is the minimum we must do? wait should receive a list of questions to wait for (object paths) and ignore the others
          # register the InterfacesAdded callback...
          # stupid but simple way: poll the answered property of the questions.first object, sleep 0.5 s, repeat

          question = questions.first # FIXME: use them all
          # TODO: detect if no UI showed up to display the question and time out?
          # for example:
          # (0..Float::INFINITY).each { |i| break if i > 100 && !question.displayed; ... }
          loop do
            answer = question.answer
            break unless answer.empty?

            sleep(0.5)
          end
        end

      private

        # @return [::DBus::Object]
        attr_reader :dbus_object
      end
    end
  end
end
