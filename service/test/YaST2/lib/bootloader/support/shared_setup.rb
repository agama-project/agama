# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

# Shared setup replicating what upstream yast2-bootloader's test/test_helper.rb applies
# unconditionally to every example via a top-level `RSpec.configure` block: a default
# devicegraph, UdevMapping stubbed to a no-op passthrough, and all real system calls mocked out.
#
# Upstream applies this globally to its whole suite; here it's an explicit, opt-in shared
# context (`include_context "yast2-bootloader test setup"`) included only by the ported
# bootloader specs, so it doesn't affect the rest of Agama's test suite.

require_relative "../../../../agama/storage/storage_helpers"
require "bootloader/udev_mapping"

Yast.import "BootStorage"
Yast.import "Bootloader"

RSpec.shared_context "yast2-bootloader test setup" do
  include Agama::RSpec::StorageHelpers

  # Loads a devicegraph fixture from service/test/fixtures/yast2/bootloader/
  #
  # @param name [String] file name (YAML or XML) within that directory
  def devicegraph_stub(name)
    mock_storage_probing(File.join("yast2", "bootloader", name))
  end

  # @param name [String] device name, e.g. "/dev/sda1"
  # @return [Y2Storage::Device]
  def find_device(name)
    graph = Y2Storage::StorageManager.instance.staging
    Y2Storage::BlkDevice.find_by_name(graph, name)
  end

  before do
    Yast::BootStorage.instance_variable_set(:@storage_revision, nil)
    allow(::Bootloader::UdevMapping).to receive(:to_mountby_device) { |d| d }
    allow(::Bootloader::UdevMapping).to receive(:to_kernel_device) { |d| d }
    devicegraph_stub("trivial.yaml")

    # mock all system operations
    allow(Yast::Execute).to receive(:on_target)
    # mock getting default section
    allow(Yast::Execute).to receive(:on_target)
      .with("/usr/bin/grub2-editenv", "list", anything).and_return("")
  end
end
