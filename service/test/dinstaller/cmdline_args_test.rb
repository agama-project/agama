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
require "dinstaller/cmdline_args"

describe DInstaller::CmdlineArgs do
  let(:workdir) { File.join(FIXTURES_PATH, "root_dir") }
  subject { described_class.new(workdir: workdir) }

  describe "#read" do
    it "reads the kernel command line options" do
      expect { subject.read }.to change { subject.args }.to({ "web" => { "ssl" => "MODIFIED" } })
        .and change { subject.config_url }.to("http://example.org/d-installer.yaml")
    end
  end
end
