# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "agama/storage/config_conversions/from_json"
require "agama/config"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

describe Agama::Storage::ConfigConversions::FromJSON do
  subject { described_class.new(config_json, product_config: product_config) }

  let(:product_config) { Agama::Config.new(product_data) }

  let(:product_data) do
    {
      "storage" => {
        "lvm"              => false,
        "space_policy"     => "delete",
        "encryption"       => {
          "method"        => "luks2",
          "pbkd_function" => "argon2id"
        },
        "volumes"          => ["/", "swap"],
        "volume_templates" => [
          {
            "mount_path" => "/",
            "outline"    => { "required" => true }
          },
          {
            "mount_path" => "/home",
            "outline"    => { "required" => false }
          },
          {
            "mount_path" => "swap",
            "outline"    => { "required" => false }
          }
        ]
      }
    }
  end

  describe "#convert" do
    let(:config_json) do
      {
        boot: {
          configure: true,
          device: "/dev/sdb"
        },
        drives: [
          {
            ptableType: "gpt",
            partitions: [
              {
                format: { filesystem: "ext4" },
                mount: { path: "/" }
              }
            ]
          }
        ]
      }
    end

    it "generates settings with the values provided from JSON" do
      config = subject.convert

      expect(config).to be_a(Agama::Storage::Config)
    end
  end
end
