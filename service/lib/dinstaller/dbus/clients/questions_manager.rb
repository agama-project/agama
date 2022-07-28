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
require "dinstaller/dbus/clients/with_service_status"

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
        # Callbacks are called after adding the question, see {#on_add}.
        #
        # @yieldparam question [Question] added question
        #
        # @param question [Question]
        # @return [Boolean] whether the question was added FIXME
        def add(question)
          q_path = @dbus_object.New(question.text, question.options.map(&:to_s), Array(question.default_option&.to_s))
          p q_path
          service[q_path]
          # question identity, the api does not really fit, New really should return an obj path
          # or whatever
        end

        # Deletes the given question
        #
        # Callbacks are called after deleting the question, see {#on_delete}.
        #
        # @yieldparam question [Question] deleted question
        #
        # @param question [Question] FIXME the yardocs are wrong here
        def delete(question)
          @dbus_object.Delete(question.path)
        end

        # Waits until all questions are answered
        #
        # Callbacks are periodically called while waiting, see {#on_wait}.
        def wait(questions)
          puts "In Wait"
          # so what is the minimum we must do? wait should receive a list of questions to wait for (object paths) and ignore the others
          # register the InterfacesAdded callback...
          # stupid but simple way: poll the answered property of the questions.first object, sleep 0.5 s, repeat
          #
          question = questions.first # FIXME: use them all
          q_proxy_iface = question["org.opensuse.DInstaller.Question1"]
          10.times do
            puts "asking answer"
            answer = q_proxy_iface["Answer"]
            puts "  it is #{answer.inspect}"
            break unless answer.empty?

            sleep(0.5)
          end
          question.define_singleton_method(:answer) { q_proxy_iface["Answer"] }
        end

        # Registers a callback to be called while waiting for questions be answered
        #
        # @param block [Proc]
        def on_wait(&block)
          on_wait_callbacks << block
        end

      private

        # Callbacks to be called when waiting for answers
        #
        # @return [Array<Proc>]
        attr_reader :on_wait_callbacks

        # Whether a question with the same id as the given question is already in the list of questions
        #
        # @param question [Question]
        # @return [Boolean]
        def include?(question)
          questions.any? { |q| q.id == question.id }
        end

        # Whether all questions are already answered
        #
        # @return [Boolean]
        def questions_answered?
          questions.all?(&:answered?)
        end

        # @return [::DBus::Object]
        attr_reader :dbus_object
      end
    end
  end
end
