# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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
require "y2storage"

describe Y2Storage::BootRequirementsStrategies::ZIPL do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(fake_devicegraph, [], "/dev/dasdc") }

  before do
    allow(Yast::Execute).to receive(:locally).with(/zkey/, any_args)
    fake_scenario("s390_luks2")
    allow(Y2Storage::BootRequirementsStrategies::Analyzer).to receive(:new).and_return(analyzer)
    allow(analyzer).to receive(:device_for_zipl).and_return(device_for_zipl)
    allow(analyzer).to receive(:encrypted_zipl?).and_return(encrypted_zipl?)
  end

  let(:analyzer) do
    Y2Storage::BootRequirementsStrategies::Analyzer.new(fake_devicegraph, [], "/dev/dasdc")
  end

  let(:device_for_zipl) { double("zipl") }
  let(:encrypted_zipl?) { false }

  context "when the boot partition is encrypted using LUKS2" do
    context "and the zipl partition is encrypted" do
      let(:encrypted_zipl?) { true }

      it "returns a warning" do
        messages = subject.warnings.map(&:message)
        expect(messages).to include(/The grub boot loader cannot access the file system/)
      end
    end

    context "and the zipl partition is unencrypted" do
      it "does not return any warning" do
        messages = subject.warnings.map(&:message)
        expect(messages).to_not include(/The grub boot loader cannot access the file system/)
      end
    end

    context "and the zipl partition is not present" do
      let(:device_for_zipl) { nil }

      it "returns a warning" do
        messages = subject.warnings.map(&:message)
        expect(messages).to include(/The grub boot loader cannot access the file system/)
      end
    end
  end
end
