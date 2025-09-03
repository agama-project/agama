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

  let(:selected) { nil }

  let(:lsm_config) do
    instance_double(Y2Security::LSM::Config, select: nil, selected: selected)
  end

  let(:apparmor) do
    instance_double(Y2Security::LSM::AppArmor, id: :apparmor)
  end

  let(:selinux) do
    instance_double(Y2Security::LSM::Selinux, id: :selinux)
  end

  let(:proposal) do
    {
      "size"     => "0 B",
      "patterns" => {
        "documentation" => 1,
        "enhanced_base" => 1,
        "sw_management" => 1,
        "yast2_basis"   => 1,
        "apparmor"      => 0,
        "minimal_base"  => 1,
        "base"          => 1,
        "x86_64_v3"     => 1
      }
    }
  end

  let(:software_client) do
    instance_double(Agama::HTTP::Clients::Software, proposal: proposal, add_patterns: nil)
  end

  before do
    allow(Y2Security::LSM::Config).to receive(:instance).and_return(lsm_config)
    allow(security).to receive(:software_client).and_return(software_client)
    allow(Yast::Bootloader).to receive(:modify_kernel_params)
    allow(lsm_config.selected).to receive(:reset_kernel_params)
    allow(lsm_config.selected).to receive(:kernel_params)
  end

  describe "#write" do
    let(:selected) { apparmor }

    context "when the software proposal patterns includes the LSM patterns" do
      it "saves kernel parameters for the LSM configuration" do
        expect(Yast::Bootloader).to receive(:modify_kernel_params)
        security.write
      end
    end

    context "when the software proposal patterns does not include the LSM patterns" do
      let(:selected) { apparmor }

      let(:proposal) do
        {
          "size"     => "0 B",
          "patterns" => {
            "documentation" => 1,
            "enhanced_base" => 1,
            "sw_management" => 1,
            "yast2_basis"   => 1,
            "minimal_base"  => 1,
            "base"          => 1,
            "x86_64_v3"     => 1
          }
        }
      end

      it "fallback to the first LSM which patterns are included by the software proposal" do
        expect(lsm_config).to receive(:select).with("none")
        expect(Yast::Bootloader).to receive(:modify_kernel_params)
        security.write
      end

      it "resets bootloader params for previous selection" do
        expect(lsm_config.selected).to receive(:reset_kernel_params)
        security.write
      end
    end
  end
end
