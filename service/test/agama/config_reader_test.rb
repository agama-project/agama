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
require "agama/config_reader"

describe Agama::ConfigReader do
  let(:workdir) { File.join(FIXTURES_PATH, "root_dir") }
  let(:logger) { Logger.new($stdout, level: :warn) }
  subject { described_class.new(logger: logger, workdir: workdir) }
  before do
    allow(Yast::Directory).to receive(:tmpdir).and_return(File.join(workdir, "tmpdir"))
    allow(subject).to receive(:copy_file)
  end

  describe "#config_from_file" do
    it "returns a Config object with the configuration read from the given file" do
      config = subject.config_from_file(File.join(workdir, "etc", "d-installer.yaml"))
      expect(config).to be_a(Agama::Config)
      expect(config.data["products"].keys).to include("Tumbleweed")
    end
  end

  describe "#config" do
    it "returns the resultant config after merging all found configurations" do
      config = subject.config
      expect(config.data.dig("web", "ssl")).to eql(true)
    end
  end

  describe "#configs" do
    it "returns an array with all the Configs present in the system" do
      configs = subject.configs
      # Default, RemoteBootConfig, CmdlineConfig
      expect(configs.size).to eql(3)
      expect(configs[0].data.dig("web", "ssl")).to eql(nil)
      expect(configs[1].data.dig("web", "ssl")).to eql(false)
      expect(configs[2].data.dig("web", "ssl")).to eql(true)
    end
  end
end
