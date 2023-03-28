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

module Agama
  # This class represents a question
  #
  # Questions are used when some information needs to be asked. For example, a question could be
  # created for asking whether to continue or not when an error is detected.
  class Question
    # Each question is identified by an unique id
    #
    # @return [Integer]
    attr_reader :id

    # Text of the question
    #
    # @return [String]
    attr_reader :text

    # Options the question offers
    #
    # The question must be answered with one of that options.
    #
    # @return [Array<Symbol>]
    attr_reader :options

    # Default option to use as answer
    #
    # @return [Symbol, nil]
    attr_reader :default_option

    # Answer of the question
    #
    # @return [Symbol, nil] nil if the question is not answered yet
    attr_reader :answer

    def initialize(text, options: [], default_option: nil)
      @id = IdGenerator.next
      @text = text
      @options = options
      @default_option = default_option
    end

    # Answers the question with an option
    #
    # @raise [ArgumentError] if the given value is not a valid answer.
    #
    # @param value [Symbol]
    def answer=(value)
      raise ArgumentError, "Invalid answer. Options: #{options}" unless valid_answer?(value)

      @answer = value
    end

    # Whether the question is already answered
    #
    # @return [Boolean]
    def answered?
      !answer.nil?
    end

  private

    # Checks whether the given value is a valid answer
    #
    # @param value [Symbol]
    # @return [Boolean]
    def valid_answer?(value)
      options.include?(value)
    end

    # Helper class for generating unique ids
    class IdGenerator
      # Generates the next id to be used
      #
      # @return [Integer]
      def self.next
        @last_id ||= 0
        @last_id += 1
      end
    end
  end
end
