#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require "y2storage/callbacks/initialize"

describe Y2Storage::Callbacks::Initialize do
  include_context "yast2-storage-ng test setup"

  subject(:callbacks) { described_class.new(error) }

  let(:error) { instance_double(Storage::LockException, locker_pid: 0) }

  describe "#retry?" do
    it "displays the lock error message" do
      expect(Yast::Report).to receive(:yesno_popup) do |message|
        expect(message).to match(/storage subsystem is locked/)
      end
      subject.retry?
    end

    it "asks the user whether to retry and returns the answer" do
      allow(Yast::Report).to receive(:yesno_popup).and_return(true, true, false)
      expect(subject.retry?).to eq(true)
      expect(subject.retry?).to eq(true)
      expect(subject.retry?).to eq(false)
    end
  end
end
