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
require "dinstaller_cli/install_config_reader"

describe DInstallerCli::InstallConfigReader do
  subject { described_class.new(source) }

  describe "#read" do
    context "when the config file cannot be loaded" do
      let(:source) { File.join(FIXTURES_PATH, "does-not-exist.yml") }

      it "raises an error" do
        expect { subject.read }.to raise_error(DInstallerCli::InstallConfigReader::Error)
      end
    end

    context "when the config file can be loaded" do
      let(:source) { File.join(FIXTURES_PATH, "config.yaml") }

      it "generates an install config with the expected content" do
        config = subject.read

        expect(config.languages).to contain_exactly("es_ES", "en_US")
        expect(config.product).to eq("Tumbleweed")
        expect(config.disks).to contain_exactly("/dev/vda", "/dev/vdb")
        expect(config.user).to_not be_nil
        expect(config.user.name).to eq("test")
        expect(config.user.fullname).to eq("User Test")
        expect(config.user.password).to eq("n0ts3cr3t")
        expect(config.user.autologin).to eq(true)
        expect(config.root.password).to eq("n0ts3cr3t")
        expect(config.root.ssh_key).to eq("1234abcd")
      end
    end
  end
end
