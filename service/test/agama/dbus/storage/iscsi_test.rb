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

require_relative "../../../test_helper"
require "agama/dbus/storage/iscsi"
require "agama/storage/iscsi/manager"

describe Agama::DBus::Storage::ISCSI do
  subject(:iscsi) { described_class.new(backend, logger: logger) }

  let(:backend) { Agama::Storage::ISCSI::Manager.new }

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#apply_config" do
    let(:serialized_config) { config_json.to_json }

    let(:config_json) do
      {
        initiator: "iqn.1996-04.de.suse:01:351e6d6249",
        targets:   [
          {
            address:   "192.168.100.151",
            port:      3260,
            name:      "iqn.2025-01.com.example:becda24e8804c6580bd0",
            interface: "default"
          }
        ]
      }
    end

    it "applies the given iSCSI config" do
      expect(backend).to receive(:apply_config_json).with(config_json)

      subject.apply_config(serialized_config)
    end

    context "if the config is correctly applied" do
      before do
        allow(backend).to receive(:apply_config_json).with(config_json).and_return(true)
      end

      it "returns 0" do
        result = subject.apply_config(serialized_config)

        expect(result).to eq(0)
      end
    end

    context "if the config is not correctly applied" do
      before do
        allow(backend).to receive(:apply_config_json).with(config_json).and_return(false)
      end

      it "returns 1" do
        result = subject.apply_config(serialized_config)

        expect(result).to eq(1)
      end
    end
  end
end
