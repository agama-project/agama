#!/usr/bin/env rspec
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage/pbkd_function"

describe Y2Storage::PbkdFunction do
  include_context "yast2-storage-ng test setup"

  subject { Y2Storage::PbkdFunction::ARGON2I }

  describe "#is?" do
    it "returns true for an equivalent function object" do
      expect(subject.is?(Y2Storage::PbkdFunction.find("argon2i"))).to eq true
    end

    it "returns false for a non-equivalent function object" do
      expect(subject.is?(Y2Storage::PbkdFunction.find("pbkdf2"))).to eq false
    end

    it "returns true for a list of symbols including the equivalent one" do
      expect(subject.is?(:argon2i, :pbkdf)).to eq true
    end

    it "returns false for list of symbols not including the equivalent one" do
      expect(subject.is?(:argon2id, :pbkdf)).to eq false
    end
  end

  describe "#===" do
    it "returns true for the equivalent object" do
      value =
        case subject
        when Y2Storage::PbkdFunction.find("argon2i")
          true
        else
          false
        end
      expect(value).to eq true
    end

    it "returns false for the equivalent symbol" do
      value =
        case subject
        when :argon2i
          true
        else
          false
        end
      expect(value).to eq false
    end
  end
end
