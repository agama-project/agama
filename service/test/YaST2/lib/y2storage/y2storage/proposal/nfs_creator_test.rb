#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::Proposal::NfsCreator do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "windows-linux-free-pc" }

  subject(:creator) { described_class.new(fake_devicegraph) }

  let(:planned_nfs0) do
    planned_nfs(
      server: server, path: path, mount_point: mount_point, fstab_options: fstab_options
    )
  end

  let(:server) { "192.168.56.1" }

  let(:path) { "/root_fs" }

  let(:mount_point) { "/" }

  let(:fstab_options) { ["rw", "wsize=8192", "acdirmax=120"] }

  describe "#create_nfs" do
    def nfs(devicegraph)
      Y2Storage::Filesystems::Nfs.find_by_server_and_path(devicegraph, server, path)
    end

    it "creates a new NFS filesystem" do
      expect(fake_devicegraph.nfs_mounts).to be_empty

      result = creator.create_nfs(planned_nfs0)

      expect(result.devicegraph.nfs_mounts.size).to eq(1)
    end

    it "sets the server name" do
      result = creator.create_nfs(planned_nfs0)
      nfs = nfs(result.devicegraph)

      expect(nfs.server).to eq(server)
    end

    it "sets the path" do
      result = creator.create_nfs(planned_nfs0)
      nfs = nfs(result.devicegraph)

      expect(nfs.path).to eq(path)
    end

    it "sets the mount path" do
      result = creator.create_nfs(planned_nfs0)
      nfs = nfs(result.devicegraph)

      expect(nfs.mount_point.path).to eq(mount_point)
    end

    it "sets the mount options" do
      result = creator.create_nfs(planned_nfs0)
      nfs = nfs(result.devicegraph)

      expect(nfs.mount_point.mount_options).to eq(fstab_options)
    end
  end
end
