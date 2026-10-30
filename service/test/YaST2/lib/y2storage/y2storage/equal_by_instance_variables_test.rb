#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage/equal_by_instance_variables"

# skeleton for the mixin
class TestEquality
  include Y2Storage::EqualByInstanceVariables

  attr_accessor :a, :b

  def initialize(aaa, bbb)
    @a = aaa
    @b = bbb
  end
end

describe Y2Storage::EqualByInstanceVariables do
  include_context "yast2-storage-ng test setup"

  describe "#==" do
    it "returns true for same class, same ivars" do
      a = TestEquality.new(1, 2)
      b = TestEquality.new(1, 2)

      expect(a).to eq b
    end

    it "returns true for same class, different ivars" do
      a = TestEquality.new(1, 2)
      b = TestEquality.new(2, 1)

      expect(a).to_not eq b
    end

    it "returns false for different class, same ivars" do
      a = TestEquality.new(1, 2)
      bb = Struct.new(:a, :b)
      b = bb.new(1, 2)

      expect(a).to_not eq b
    end

    it "returns false for a completely different class" do
      a = TestEquality.new(1, 2)
      b = Object.new

      expect(a).to_not eq b
    end
  end
end
