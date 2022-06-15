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
require "dinstaller_cli/install_config"

describe DInstallerCli::InstallConfig do
  subject { described_class.new }

  before do
    subject.product = "Tumbleweed"
    subject.languages = ["en_UK", "es_ES"]
    subject.disks = ["/dev/vda"]
    subject.user = DInstallerCli::InstallConfig::User.new.tap do |user|
      user.name = "test"
      user.autologin = true
      user.password = "n0ts3cr3t"
    end
    subject.root = DInstallerCli::InstallConfig::Root.new.tap do |root|
      root.ssh_key = "1234abcd"
      root.password = ""
    end
  end

  describe "#dump" do
    it "dumps the content in YAML format" do
      expect(subject.dump).to eq(
        "---\n" \
        "product: Tumbleweed\n" \
        "languages:\n" \
        "- en_UK\n" \
        "- es_ES\n" \
        "disks:\n" \
        "- \"\/dev\/vda\"\n" \
        "user:\n" \
        "  name: test\n" \
        "  fullname:\n" \
        "  autologin: true\n" \
        "  password: n0ts3cr3t\n" \
        "root:\n" \
        "  ssh_key: 1234abcd\n" \
        "  password: ''\n"
      )
    end
  end

  describe "#to_h" do
    it "converts the config to a hash" do
      expect(subject.to_h).to eq(
        {
          "product"   => "Tumbleweed",
          "languages" => ["en_UK", "es_ES"],
          "disks"     => ["/dev/vda"],
          "user"      => {
            "name"      => "test",
            "fullname"  => nil,
            "autologin" => true,
            "password"  => "n0ts3cr3t"
          },
          "root"      => {
            "ssh_key"  => "1234abcd",
            "password" => ""
          }
        }
      )
    end

    context "when there is no user" do
      before do
        subject.user = nil
      end

      it "returns an empty hash for the user key" do
        expect(subject.to_h["user"]).to eq({})
      end
    end

    context "when there is no root" do
      before do
        subject.root = nil
      end

      it "returns an empty hash for the root key" do
        expect(subject.to_h["root"]).to eq({})
      end
    end
  end
end
