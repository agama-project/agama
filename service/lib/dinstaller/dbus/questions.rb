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

require "dbus"
require "pathname"
require "dinstaller/question"
require "dinstaller/luks_activation_question"
require "dinstaller/dbus/question"

module DInstaller
  module DBus
    # This class represents a D-Bus object implementing ObjectManager interface for questions
    class Questions < ::DBus::Object
      include ::DBus::ObjectManager

      PATH = "/org/opensuse/DInstaller/Questions1"
      private_constant :PATH

      QUESTIONS_INTERFACE = "org.opensuse.DInstaller.Questions1"
      private_constant :QUESTIONS_INTERFACE

      # Constructor
      #
      # @param logger [Logger]
      def initialize(logger: nil)
        @logger = logger || Logger.new($stdout)

        super(PATH)
      end

      dbus_interface QUESTIONS_INTERFACE do
        # default_option is an array of 0 or 1 elements
        dbus_method :New, "in text:s, in options:as, in default_option:as, out q:o" do
          |text, options, default_option|

          question = DInstaller::Question.new(
            text,
            options:        options.map(&:to_sym),
            default_option: default_option.map(&:to_sym).first
          )

          export(question)
        end

        dbus_method :NewLuksActivation, "in device:s, in label:s, in size:s, in attempt:y, out q:o" do
          |device, label, size, attempt|

          question = DInstaller::LuksActivationQuestion.new(
            device, label: label, size: size, attempt: attempt
          )

          export(question)
        end

        dbus_method :Delete, "in question:o" do |question_path|
          dbus_question = @service.get_node(question_path)&.object

          raise ArgumentError, "Object path #{question_path} not found" unless dbus_question

          if !dbus_question.is_a?(DInstaller::DBus::Question)
            raise ArgumentError, "Object #{question_path} is not a Question"
          end

          @service.unexport(dbus_question)
        end
      end

    private

      # @return [Logger]
      attr_reader :logger

      # Exports a new question object
      #
      # @param question [DInstaller::Question]
      # @return [::DBus::ObjectPath]
      def export(question)
        dbus_question = DBus::Question.new(path_for(question), question, logger)
        @service.export(dbus_question)

        dbus_question.path
      end

      # Builds the question path (e.g., /org/opensuse/DInstaller/Questions1/1)
      #
      # @param question [DInstaller::Question]
      # @return [::DBus::ObjectPath]
      def path_for(question)
        path = Pathname.new(PATH).join(question.id.to_s)

        ::DBus::ObjectPath.new(path.to_s)
      end
    end
  end
end
