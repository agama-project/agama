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

require_relative "../test_helper"
require "dinstaller/network"
require "dinstaller/progress"

describe DInstaller::Network do
  subject(:network) { described_class.new(logger) }

  let(:logger) { Logger.new($stdout) }
  let(:proposal) do
    instance_double(Y2Network::ProposalSettings, apply_defaults: nil, refresh_packages: nil)
  end
  let(:progress) { DInstaller::Progress.new }

  describe "#probe" do
    before do
      allow(Yast::Lan).to receive(:read_config)
      allow(Y2Network::ProposalSettings).to receive(:instance).and_return(proposal)
    end

    it "reads the network configuration" do
      expect(Yast::Lan).to receive(:read_config)
      network.probe(progress)
    end

    it "refresh packages and apply defaults" do
      expect(proposal).to receive(:refresh_packages)
      expect(proposal).to receive(:apply_defaults)
      network.probe(progress)
    end
  end

  describe "#install" do
    it "runs the save_network client" do
      expect(Yast::WFM).to receive(:CallFunction).with("save_network", [])
      network.install(progress)
    end
  end
end
