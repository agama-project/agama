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

require_relative "../../../test_helper"
require "agama/dbus/storage/dasd"

describe DInstaller::DBus::Storage::Dasd do
  subject { described_class.new(y2s390_dasd1, path, logger: logger) }

  let(:y2s390_dasd1) { instance_double("Y2S390::Dasd") }
  let(:y2s390_dasd2) do
    instance_double(
      "Y2S390::Dasd", id: "0.0.002", offline?: true, device_name: nil, formatted?: false,
      diag_wanted: false, type: nil, access_type: nil, partition_info: "", status: :unknown,
      device_type: ""
    )
  end
  let(:path) { "/org/opensuse/DInstaller/Storage1/dasds/1" }
  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(subject).to receive(:dbus_properties_changed)
  end

  describe "#dasd=" do
    it "sets the iSCSI node value" do
      allow(subject).to receive(:dbus_properties_changed)

      expect(subject.dasd).to_not eq y2s390_dasd2
      subject.dasd = y2s390_dasd2
      expect(subject.dasd).to eq y2s390_dasd2
    end

    it "emits properties changed signal" do
      expect(subject).to receive(:dbus_properties_changed)

      subject.dasd = y2s390_dasd2
    end
  end
end
