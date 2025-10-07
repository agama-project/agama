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

require "agama/dbus/clients/base"
require "agama/dbus/clients/question"
require "agama/question_with_password"

module Agama
  module DBus
    module Clients
      # D-Bus client for asking a question.
      class Questions < Base
        # Constructor
        #
        # @param logger [Logger, nil]
        def initialize(logger: nil)
          super

          @dbus_object = service["/org/opensuse/Agama1/Questions"]
          @dbus_object.default_iface = "org.opensuse.Agama1.Questions"
        end

        # @return [String]
        def service_name
          @service_name ||= "org.opensuse.Agama1"
        end

        # Adds a question
        #
        # @param question [Agama::Question]
        # @return [DBus::Clients::Question]
        def add(question)
          dbus_path = add_question(question)
          DBus::Clients::Question.new(dbus_path)
        end

        # Deletes the given question
        #
        # @raise [::DBus::Error] if trying to delete a question twice
        #
        # @param question [DBus::Clients::Question]
        # @return [void]
        def delete(question)
          @dbus_object.Delete(question.dbus_object.path)
        end

        # Waits until specified questions are answered
        #
        # @param questions [Array<DBus::Clients::Question>]
        # @return [void]
        def wait(questions)
          logger.info "Waiting for questions to be answered"

          # TODO: detect if no UI showed up to display the questions and time out?
          # for example:
          # (0..Float::INFINITY).each { |i| break if i > 100 && !question.displayed; ... }

          # We should register the InterfacesAdded callback... BEFORE adding to avoid races.
          # Stupid but simple way: poll the answer property, sleep, repeat
          loop do
            questions = questions.find_all { |q| !q.answered? }
            break if questions.empty?

            sleep(0.5)
          end
        end

        # Asks the given question and waits until the question is answered
        #
        # @example
        #   ask(question1)                           #=> Symbol
        #   ask(question2) { |q| q.answer == :yes }  #=> Boolean
        #
        # @param question [Agama::Question]
        # @yield [Agama::DBus::Clients::Question] Gives the answered question to the block.
        # @return [Symbol, Object] The question answer, or the result of the block in case a block
        #   is given.
        def ask(question)
          question_client = add(question)
          wait([question_client])

          answer = question_client.answer
          logger.info("#{question.text} #{answer}")

          result = block_given? ? yield(question_client) : answer
          delete(question_client)

          result
        end

      private

        # @return [::DBus::Object]
        attr_reader :dbus_object

        # Adds a question using the proper D-Bus method according to the question type
        #
        # @param question [Agama::Question]
        # @return [::DBus::ObjectPath]
        def add_question(question)
          if question.is_a?(Agama::QuestionWithPassword)
            add_question_with_password(question)
          else
            add_generic_question(question)
          end
        end

        # Adds a generic question
        #
        # @param question [Agama::Question]
        # @return [::DBus::ObjectPath]
        def add_generic_question(question)
          @dbus_object.New(
            question.qclass,
            question.text,
            question.options.map(&:to_s),
            question.option_labels,
            question.default_option.to_s,
            question.data
          )
        end

        # Adds a question for activating LUKS
        #
        # @param question [Agama::QuestionWithPassword]
        # @return [::DBus::ObjectPath]
        def add_question_with_password(question)
          @dbus_object.NewWithPassword(
            question.qclass,
            question.text,
            question.options.map(&:to_s),
            question.option_labels,
            question.default_option.to_s,
            question.data
          )
        end
      end
    end
  end
end
