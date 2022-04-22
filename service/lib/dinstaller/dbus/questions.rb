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

require "dbus"
require "dinstaller/dbus/question"

module DInstaller
  module DBus
    # This class mimics the basic functionality of ObjectManager. Note that ruby-dbus does not
    # support ObjectManager yet.
    #
    # What does a {DBus::Questions} object do:
    #
    # * Uses a {QuestionsManager} as backend.
    # * Exports a {DBus::Question} object when a {DInstaller::Question} is added to the questions
    #   manager.
    # * Unexports a {DBus::Question} object when a {DInstaller::Question} is deleted from the
    #   questions manager.
    # * Ensures that D-Bus messages are dispatched while questions manager waits for all questions
    #   be answered.
    #
    # Questions are exported in D-Bus in a tree form similar to ObjectManager. For example:
    #
    # /org/opensuse/DInstaller/Questions1
    #   /org/opensuse/DInstaller/Questions1/1
    #   /org/opensuse/DInstaller/Questions1/2
    #   /org/opensuse/DInstaller/Questions1/3
    #
    # This class configures the callbacks of {QuestionsManager} to ensure that the proper D-Bus
    # actions are performed when adding, deleting or waiting for answers.
    class Questions < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Questions1"
      private_constant :PATH

      QUESTIONS_INTERFACE = "org.opensuse.DInstaller.Questions1"
      private_constant :QUESTIONS_INTERFACE

      # Path of the object
      #
      # {DBus::Question} objects are dynamically exported under this path.
      #
      # @return [String]
      def self.path
        PATH
      end

      # Constructor
      #
      # The callbacks of the backend are configured to perform the proper D-Bus actions, see
      # {#register_callbacks}.
      #
      # @param backend [DInstaller::QuestionsManager]
      # @param logger [Logger]
      def initialize(backend, logger)
        @backend = backend
        @logger = logger
        @exported_questions = []

        register_callbacks

        super(PATH)
      end

      # Paths of all currently exported questions
      #
      # @warn This method is used to implement a D-Bus reader method. Do not use it to recover all
      #   the {Question} objects.
      #
      # @return [Array<::DBus::ObjectPath>]
      def all
        exported_questions.map(&:path)
      end

      dbus_interface QUESTIONS_INTERFACE do
        dbus_reader :all, "as"
      end

    private

      # @return [DInstaller::QuestionsManager]
      attr_reader :backend

      # @return [Logger]
      attr_reader :logger

      # Currently exported questions
      #
      # @return [Array<DBus::Question>]
      attr_reader :exported_questions

      # Callbacks with actions to do when adding, deleting or waiting for questions
      def register_callbacks
        # When adding a question, a new question is exported on D-Bus.
        backend.on_add do |question|
          dbus_object = DBus::Question.new(question, logger)
          @service.export(dbus_object)
          exported_questions << dbus_object
          PropertiesChanged(QUESTIONS_INTERFACE, { "All" => all }, [])
        end

        # When removing a question, the question is unexported from D-Bus.
        backend.on_delete do |question|
          dbus_object = exported_questions.find { |q| q.id == question.id }
          if dbus_object
            @service.unexport(dbus_object)
            exported_questions.delete(dbus_object)
            PropertiesChanged(QUESTIONS_INTERFACE, { "All" => all }, [])
          end
        end

        # Bus dispatches messages while waiting for questions to be answered
        backend.on_wait { @service.bus.dispatch_message_queue }
      end
    end
  end
end
