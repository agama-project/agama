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
require "dinstaller/security"

describe DInstaller::Security do
  subject { described_class.new(logger, config) }

  let(:logger) { Logger.new($stdout) }

  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "d-installer.yaml")
  end

  let(:config) do
    DInstaller::Config.new(YAML.safe_load(File.read(config_path)))
  end

  let(:y2security) do
    instance_double(Y2Security::LSM::Config, select: nil)
  end

  before do
    allow(Y2Security::LSM::Config).to receive(:instance).and_return(y2security)
  end

  describe "#probe" do
    it "selects the default LSM" do
      expect(y2security).to receive(:select).with("apparmor")
      subject.probe
    end
  end
end
