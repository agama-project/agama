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

# This test documents (and guards) the call path that makes a translated string from the vendored
# YaST code (service/YaST2, textdomain "storage") reach the issues returned by the D-Bus service.
# See service/translations.md.
#
# Set the TRACE_TRANSLATIONS environment variable to print the captured backtraces.

require_relative "../../test_helper"
require_relative "storage_helpers"
require "agama/config"
require "agama/storage/manager"
require "y2storage"
require "yaml"

Yast::ProductFeatures.InitFeatures(true)

describe "Translated AutoYaST storage issues" do
  include Agama::RSpec::StorageHelpers
  using Y2Storage::Refinements::SizeCasts

  let(:logger) { Logger.new($stdout, level: :fatal) }

  let(:config) { Agama::Config.new(YAML.load_file(File.join(FIXTURES_PATH, "storage.yaml"))) }

  let(:arch) do
    instance_double(Y2Storage::Arch, x86?: true, efiboot?: true, ram_size: 4.GiB.to_i)
  end

  let(:manager) do
    Agama::Storage::Manager.new(logger: logger).tap { |m| m.update_product_config(config) }
  end

  # Backtraces (as arrays of "file:line:in 'method'") of the NoDisk construction and of every call
  # to NoDisk#message, restricted to the frames from service/lib and service/YaST2.
  let(:created_at) { [] }
  let(:message_at) { [] }

  def relevant(frames)
    frames
      .select { |f| f.include?("/service/lib/") || f.include?("/service/YaST2/") }
      .map { |f| f.sub(%r{\A.*/service/}, "") }
  end

  def print_trace(title, frames)
    return unless ENV["TRACE_TRANSLATIONS"]

    puts("=== #{title}", frames.map { |f| "  #{f}" })
  end

  before do
    mock_storage(devicegraph: "windows-linux-pc.yml")
    allow(Y2Storage::Arch).to receive(:new).and_return(arch)

    klass = Y2Storage::AutoinstIssues::NoDisk
    allow(klass).to receive(:new).and_wrap_original do |original, *args|
      created_at.concat(relevant(caller))
      original.call(*args)
    end
    allow_any_instance_of(klass).to receive(:message).and_wrap_original do |original, *args|
      message_at.concat(relevant(caller))
      original.call(*args)
    end
  end

  # AutoYaST config asking for a disk that does not exist
  let(:json) do
    { legacyAutoyastStorage: [{ "device" => "/dev/nonexistent", "use" => "all" }] }
  end

  it "returns the issue description translated in the 'storage' domain" do
    manager.configure(json)

    print_trace("NoDisk created", created_at)
    print_trace("NoDisk#message", message_at)

    descriptions = manager.issues.map(&:description)
    expect(descriptions).to include("Disk '/dev/nonexistent' was not found")
  end

  it "creates the issue (without translating it) from the AutoYaST proposal" do
    manager.configure(json)

    expect(created_at.join("\n")).to include(
      "YaST2/lib/installation/autoinst_issues/list.rb",
      "YaST2/lib/y2storage/proposal/autoinst_drives_map.rb",
      "YaST2/lib/y2storage/autoinst_proposal.rb",
      "lib/agama/storage/proposal_strategies/autoyast.rb",
      "lib/agama/storage/configurator.rb"
    )
  end

  it "translates the issue when the Agama issues are built" do
    manager.configure(json)

    expect(message_at.join("\n")).to include(
      "lib/agama/storage/proposal_strategies/autoyast.rb",
      "lib/agama/storage/proposal.rb",
      "lib/agama/storage/manager.rb"
    )
  end
end
