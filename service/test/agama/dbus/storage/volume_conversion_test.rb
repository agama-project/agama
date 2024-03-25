# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
require "agama/config"
require "agama/storage/volume"
require "agama/dbus/storage/volume_conversion"

describe Agama::DBus::Storage::VolumeConversion do
  describe "#from_dbus" do
    let(:config) { Agama::Config.new }

    let(:dbus_volume) { {} }

    let(:logger) { Logger.new($stdout, level: :warn) }

    it "generates a volume from D-Bus settings" do
      result = described_class.from_dbus(dbus_volume, config: config, logger: logger)
      expect(result).to be_a(Agama::Storage::Volume)
    end
  end

  describe "#to_dbus" do
    let(:volume) { Agama::Storage::Volume.new("/test") }

    it "generates D-Bus settings from a volume" do
      result = described_class.to_dbus(volume)
      expect(result).to be_a(Hash)
    end
  end
end
