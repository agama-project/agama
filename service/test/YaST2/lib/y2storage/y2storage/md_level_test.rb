#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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
require "y2storage/md_level"

describe Y2Storage::MdLevel do
  include_context "yast2-storage-ng test setup"

  describe "#to_human_string" do
    context "when there is a translation" do
      it "returns the translated string" do
        described_class.all.each do |value|
          expect(value.to_human_string).to be_a(::String)
        end
      end
    end

    context "when there is no translation" do
      subject { described_class.all.first }

      before do
        allow(subject).to receive(:to_sym).and_return(:crazy_stuff)
      end

      it "raises a RuntimeError" do
        expect { subject.to_human_string }.to raise_error(RuntimeError)
      end
    end
  end
end
