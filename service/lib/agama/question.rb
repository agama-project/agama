# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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
  # This class represents a question to be created
  #
  # Questions are used when some information needs to be asked. For example, a question could be
  # created for asking whether to continue or not when an error is detected.
  class Question
    # Class of the question
    # Helps with identification of same type of questions
    #
    # @return [String]
    attr_reader :qclass

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

    # Additional data to hold identify question or improve UI to display it
    # It is tight with {qclass}.
    #
    # @return [Hash<String,String>]
    attr_reader :data

    def initialize(qclass:, text:, options:, default_option: nil, data: {})
      @qclass = qclass
      @text = text
      @options = options
      @default_option = default_option
      @data = data
    end
  end
end
