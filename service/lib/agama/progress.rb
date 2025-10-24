# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "json"

module Agama
  class Progress
    class MissingStep < StandardError; end

    # @return [Integer]
    attr_reader :size

    # @return [Array<String>]
    attr_reader :steps

    # @return [String, nil]
    attr_reader :step

    # @return [Integer]
    attr_reader :index

    # @param steps [Array<String>]
    # @return [Progress]
    def self.new_with_steps(steps)
      @size = steps.size
      @steps = steps
      @step = steps.first
      @index = 1
    end

    # @param size [Integer]
    # @param step [String]
    # @return [Progress]
    def initialize(size, step)
      @size = size
      @steps = []
      @step= step
      @index = 1
    end

    def next
      raise MissingStep if index == steps.size

      @step = steps.at(@index)
      @index += 1
    end

    # @param step [String]
    def next_with_step(step)
      self.next
      @step = step
    end

    def to_json(*args)
      {
        "size"  => @size,
        "steps" => @steps,
        "step"  => @step || "",
        "index" => @index
      }.to_json(*args)
    end
  end
end
