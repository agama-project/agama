#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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

RSpec.shared_context "proposal" do
  include Yast::Logger
  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)

    allow(Y2Storage::DiskAnalyzer).to receive(:new).and_return disk_analyzer

    # NOTE: Original method Y2Storage::Filesystems::Base#windows_system? tries to mount the
    # filesystem to check if it contains a Windows system. This behaviour is mocked here to avoid
    # the mounting action. For unit tests using this context file, a filesystem is considered to
    # contain a Windows system when it is labeled as "windows".
    allow_any_instance_of(Y2Storage::Filesystems::Base).to receive(:windows_system?) do |fs|
      /windows/.match?(fs.label.downcase)
    end

    allow_any_instance_of(Y2Storage::Partition).to receive(:detect_resize_info)
      .and_return(resize_info)

    allow(Yast::Arch).to receive(:x86_64).and_return(architecture == :x86)
    allow(Yast::Arch).to receive(:i386).and_return(architecture == :i386)
    allow(Yast::Arch).to receive(:s390).and_return(architecture == :s390)

    allow(storage_arch).to receive(:ppc_power_nv?).and_return(ppc_power_nv)
    allow(storage_arch).to receive(:efiboot?).and_return(false)

    Yast::ProductFeatures.Import(control_file_content)

    allow(Yast::SCR).to receive(:Read).and_call_original

    allow(Yast::SCR).to receive(:Read).with(path(".proc.meminfo"))
      .and_return("memtotal" => memtotal)
  end

  let(:storage_arch) { instance_double(Storage::Arch) }
  let(:architecture) { :x86 }
  let(:ppc_power_nv) { false }

  let(:memtotal) { 8.GiB.to_i / 1.KiB.to_i }

  let(:disk_analyzer) { Y2Storage::DiskAnalyzer.new(fake_devicegraph) }
  let(:resize_info) do
    instance_double("Y2Storage::ResizeInfo", resize_ok?: true, min_size: 40.GiB, max_size: 800.GiB,
      reasons: 0, reason_texts: [])
  end

  let(:separate_home) { false }
  let(:lvm) { false }
  let(:lvm_strategy) { nil }
  let(:encrypt) { false }
  let(:test_with_subvolumes) { false }

  let(:settings) do
    settings = Y2Storage::ProposalSettings.new_for_current_product
    home = settings.volumes.find { |v| v.mount_point == "/home" }
    home.proposed = separate_home if home
    settings.lvm = lvm
    settings.lvm_vg_strategy = lvm_strategy if lvm && lvm_strategy
    settings.encryption_password = encrypt ? "12345678" : nil
    settings
  end

  let(:control_file) { nil }

  let(:control_file_content) do
    if control_file
      file = File.join(DATA_PATH, "control_files", control_file)
      Yast::XML.XMLToYCPFile(file)
    else
      {}
    end
  end

  let(:expected_scenario) { scenario }
  let(:expected_scenario_filename) do
    file_name = expected_scenario
    file_name.concat("-enc") if encrypt
    if lvm
      file_name.concat("-lvm")
      file_name.concat("-#{lvm_strategy}") if lvm_strategy
    end
    file_name.concat("-sep-home") if separate_home
    file_name
  end
  let(:expected) do
    full_path = output_file_for(expected_scenario_filename)
    devicegraph = Y2Storage::Devicegraph.new_from_file(full_path)
    log.info("Expected devicegraph from file\n#{full_path}:\n\n#{devicegraph.to_str}\n")
    devicegraph
  end

  def disk_for(mountpoint)
    proposal.devices.disks.detect do |disk|
      disk.partitions.any? { |p| p.filesystem_mountpoint == mountpoint }
    end
  end
end
