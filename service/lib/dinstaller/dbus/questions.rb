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
require "pathname"
require "dinstaller/dbus/question"

module DInstaller
  module DBus
    # This class represents a D-Bus object implementing ObjectManager interface for questions
    #
    # {DBus::Questions} uses a {QuestionsManager} as backend and exports a {DBus::Question} object
    # when a {DInstaller::Question} is added to the questions manager. A {DBus::Question} is
    # unexported when a {DInstaller::Question} is deleted from the questions manager.
    #
    # Callbacks of {QuestionsManager} are used to ensure that the proper D-Bus actions are performed
    # when adding, deleting or waiting for answers.
    class Questions < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Questions1"
      private_constant :PATH

      QUESTIONS_INTERFACE = "org.opensuse.DInstaller.Questions1"
      private_constant :QUESTIONS_INTERFACE

      OBJECT_MANAGER_INTERFACE = "org.freedesktop.DBus.ObjectManager"
      private_constant :OBJECT_MANAGER_INTERFACE

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

      # Information provided by ObjectManger for each exported object
      #
      # Returns a hash containing paths of exported objects as keys. Each value is the information
      # of interfaces and properties for that object, see {BaseObject#interfaces_and_properties}.
      #
      # @return [Hash]
      def managed_objects
        exported_questions.each_with_object({}) { |q, h| h[q.path] = q.interfaces_and_properties }
      end

      dbus_interface OBJECT_MANAGER_INTERFACE do
        dbus_method(:GetManagedObjects, "out res:a{oa{sa{sv}}}") { [managed_objects] }
        dbus_signal(:InterfacesAdded, "object:o, interfaces_and_properties:a{sa{sv}}")
        dbus_signal(:InterfacesRemoved, "object:o, interfaces:as")
      end

      dbus_interface QUESTIONS_INTERFACE do
        # default_option is an array of 0 or 1 elements
        dbus_method :New, "in text:s, in options:as, in default_option:as, out q:o" do |text, options, default_option|
          backend_q = DInstaller::Question.new(
            text,
            options:        options.map(&:to_sym),
            default_option: default_option.map(&:to_sym).first
          )
          backend.add(backend_q)
          path_for(backend_q)
        end

        dbus_method :Delete, "in question:o" do |question_path|
          dbus_q = @service.get_node(question_path)&.object
          backend_q = dbus_q.backend
          backend.delete(backend_q)
        end
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

      # Builds the question path (e.g., org.opensuse.DInstaller/Questions1/1)
      #
      # @param question [DInstaller::Question]
      # @return [::DBus::ObjectPath]
      def path_for(question)
        path = Pathname.new(PATH).join(question.id.to_s)

        ::DBus::ObjectPath.new(path.to_s)
      end

      # Callbacks with actions to do when adding, deleting or waiting for questions
      def register_callbacks
        # When adding a question, a new question is exported on D-Bus.
        backend.on_add do |question|
          dbus_object = DBus::Question.new(path_for(question), question, logger)
          @service.export(dbus_object)
          exported_questions << dbus_object
          InterfacesAdded(dbus_object.path, dbus_object.interfaces_and_properties)
        end

        # When removing a question, the question is unexported from D-Bus.
        backend.on_delete do |question|
          dbus_object = exported_questions.find { |q| q.id == question.id }
          if dbus_object
            @service.unexport(dbus_object)
            exported_questions.delete(dbus_object)
            InterfacesRemoved(dbus_object.path, dbus_object.intfs.keys)
          end
        end

        # Bus dispatches messages while waiting for questions to be answered
        backend.on_wait { @service.bus.dispatch_message_queue }
      end
    end
  end
end
