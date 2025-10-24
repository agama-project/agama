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
require "agama/cmdline_args"

describe Agama::CmdlineArgs do
  let(:workdir) { File.join(FIXTURES_PATH, "root_dir") }
  subject { described_class.new(workdir: workdir) }

  describe ".read_from" do
    it "reads the kernel command line options and return a CmdlineArgs object" do
      args = described_class.read_from(File.join(workdir, "/run/agama/cmdline.d/agama.conf"))
      expect(args.data["auto"]).to eq("http://mydomain.org/tumbleweed.jsonnet")
    end

    it "sets #config_url if specified on cmdline" do
      args = described_class.read_from(File.join(workdir, "/run/agama/cmdline.d/agama.conf"))
      expect(args.config_url).to eql("http://example.org/agama.yaml")
    end

    it "converts 'true' and  'false' values into booleans" do
      args = described_class.read_from(File.join(workdir, "/run/agama/cmdline.d/agama.conf"))
      expect(args.data["web"]).to eql({ "ssl" => true })
    end

    it "converts keys with dots after 'agama.' to hash" do
      args = described_class.read_from(File.join(workdir, "/run/agama/cmdline.d/agama.conf"))
      # here fixture has agama.web.ssl=true and result is this hash
      expect(args.data["web"]).to eq({ "ssl" => true })
    end

    it "properly parse values that contain '='" do
      args = described_class.read_from(File.join(workdir, "/run/agama/cmdline.d/agama.conf"))
      expect(args.data["install_url"]).to eq("cd:/?devices=/dev/sr1")
    end

    it "properly parse values starting with inst" do
      args = described_class.read_from(File.join(workdir, "/run/agama/cmdline.d/agama.conf"))
      expect(args.data["install_url"]).to eq("cd:/?devices=/dev/sr1")
    end

    it "does not crash when parsing both plain option and nested option" do
      broken_config = File.join(workdir, "/run/agama/cmdline.d/broken-agama.conf")
      expect { described_class.read_from(broken_config) }.to_not raise_error
    end

    it "does not crash when parsing both nested option and plain option" do
      broken_config = File.join(workdir, "/run/agama/cmdline.d/broken-agama2.conf")
      expect { described_class.read_from(broken_config) }.to_not raise_error
    end
  end
end
