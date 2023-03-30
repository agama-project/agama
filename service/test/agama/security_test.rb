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
require "agama/security"

describe Agama::Security do
  subject(:security) { described_class.new(logger, config) }

  let(:logger) { Logger.new($stdout) }

  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "agama.yaml")
  end

  let(:config) do
    Agama::Config.new(YAML.safe_load(File.read(config_path)))
  end

  let(:lsm_config) do
    instance_double(Y2Security::LSM::Config, select: nil)
  end

  before do
    allow(Y2Security::LSM::Config).to receive(:instance).and_return(lsm_config)
  end

  describe "#probe" do
    it "selects the default LSM" do
      expect(lsm_config).to receive(:select).with("apparmor")
      security.probe
    end

    it "add LSM patterns for installation" do
      expect(Yast::PackagesProposal).to receive(:SetResolvables)
        .with("LSM", :pattern, ["apparmor"])
      security.probe
    end

    context "when no LSM is selected" do
      before do
        allow(config).to receive(:data).and_return({ "security" => {} })
      end

      it "unselects the LSM" do
        expect(lsm_config).to receive(:select).with(nil)
        security.probe
      end

      it "removes the list of patterns to install" do
        Yast::PackagesProposal.SetResolvables("LSM", :pattern, [])
        security.probe
      end
    end
  end

  describe "#write" do
    it "saves the LSM configuration" do
      expect(lsm_config).to receive(:save)
      security.write
    end
  end
end
