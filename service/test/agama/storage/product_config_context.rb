# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/config"

shared_context "product config" do
  let(:product_config) { Agama::Config.new(product_data) }

  let(:product_data) do
    {
      "storage" => {
        "lvm"              => lvm,
        "space_policy"     => space_policy,
        "volumes"          => volumes,
        "volume_templates" => volume_templates
      }
    }
  end

  let(:lvm) { nil }

  let(:space_policy) { nil }

  let(:volumes) { ["/"] }

  let(:volume_templates) do
    [
      {
        "mount_path" => "/",
        "filesystem" => "btrfs",
        "outline"    => { "filesystems" => ["btrfs", "xfs"] }
      }
    ]
  end

  let(:default_paths) { product_config.default_paths }

  let(:mandatory_paths) { product_config.mandatory_paths }
end
