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
require "dinstaller/question"
require "dinstaller/luks_question"

module DInstaller
  module DBus
    # Class to represent a question on D-Bus
    #
    # Questions are dynamically exported on D-Bus. All questions are exported as children of
    # {DBus::Questions} object.
    #
    # Clients should provide an answer for each question.
    class Question < ::DBus::Object
      # This module contains the D-Bus interfaces that question D-Bus object can implement. The
      # interfaces that a question implements are dynamically determined while creating a new
      # D-Bus question.
      module Interfaces
        # Generic interface for a question
        module Question
          QUESTION_INTERFACE = "org.opensuse.DInstaller.Question1"
          private_constant :QUESTION_INTERFACE

          # @!method backend
          #   @note Classes including this mixin must define a #backend method
          #   @return [DInstaller::Question]

          # Unique id of the question
          #
          # @return [Integer]
          def id
            backend.id
          end

          # Text of the question
          #
          # @return [String]
          def text
            backend.text
          end

          # Options the question admits as answer
          #
          # @note Clients are responsible of generating the proper label for each option.
          #
          # @return [Array<String>]
          def options
            backend.options.map(&:to_s)
          end

          # Default option a client should offer as answer
          #
          # @return [String]
          def default_option
            backend.default_option.to_s
          end

          # Answer selected for a client
          #
          # @return [String]
          def answer
            backend.answer.to_s
          end

          # Selects an option as answer
          #
          # @param option [String]
          def answer=(option)
            backend.answer = option.to_sym
          end

          def self.included(base)
            base.class_eval do
              dbus_interface QUESTION_INTERFACE do
                dbus_reader :id, "u"
                dbus_reader :text, "s"
                dbus_reader :options, "as"
                dbus_reader :default_option, "s"
                dbus_accessor :answer, "s"
              end
            end
          end
        end

        # Interface to request a LUKS password
        module LuksPassword
          LUKS_PASSWORD_INTERFACE = "org.opensuse.DInstaller.Question.LuksPassword1"
          private_constant :LUKS_PASSWORD_INTERFACE

          # @!method backend
          #   @note Classes including this mixin must define a #backend method
          #   @return [DInstaller::Question]

          # Given password
          #
          # @return [String]
          def luks_password
            backend.password || ""
          end

          # Sets a password
          #
          # @param value [String]
          def luks_password=(value)
            backend.password = value
          end

          def self.included(base)
            base.class_eval do
              dbus_interface LUKS_PASSWORD_INTERFACE do
                dbus_accessor :luks_password, "s", dbus_name: "Value"
              end
            end
          end
        end
      end

      # Defines the interfaces to implement according to the backend type
      INTERFACES_TO_INCLUDE = {
        DInstaller::Question     => [Interfaces::Question],
        DInstaller::LuksQuestion => [Interfaces::Question, Interfaces::LuksPassword]
      }.freeze
      private_constant :INTERFACES_TO_INCLUDE

      # Constructor
      #
      # @param path [::DBus::ObjectPath]
      # @param backend [DInstaller::Question]
      # @param logger [Logger]
      def initialize(path, backend, logger)
        @backend = backend
        @logger = logger

        super(path)

        add_interfaces
      end

    private

      # @return [DInstaller::Question]
      attr_reader :backend

      # Adds interfaces to the question
      def add_interfaces
        INTERFACES_TO_INCLUDE[backend.class].each { |i| singleton_class.include(i) }
      end
    end
  end
end
