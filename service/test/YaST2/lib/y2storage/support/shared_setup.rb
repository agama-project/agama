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

# Shared setup replicating what upstream yast2-storage-ng's test/spec_helper.rb applies
# unconditionally to its whole suite via a top-level `RSpec.configure` block (stubbed
# Y2Packager::Repository, mocked Yast::Arch/Y2Storage::Arch, a default HWInfoReader
# double, Bcache-unsupported-check disabled by default, and a ProductFeatures reset).
#
# Upstream applies this globally; here it's an explicit, opt-in shared context
# (`include_context "yast2-storage-ng test setup"`) included only by the ported
# y2storage specs, so it doesn't affect the rest of Agama's test suite.
#
# It also defines the TEST_PATH/DATA_PATH constants that the vendored support files
# (support/storage_helpers.rb and friends) and the ported specs themselves rely on via
# `require_relative "#{TEST_PATH}/support/..."` and `File.join(DATA_PATH, ...)`.

TEST_PATH = File.expand_path("..", __dir__)
DATA_PATH = File.join(FIXTURES_PATH, "yast2", "y2storage")

require_relative "storage_helpers"

RSpec.shared_context "yast2-storage-ng test setup" do
  include Yast::RSpec::StorageHelpers

  before do
    # Y2Packager is kept as a real runtime dependency (see service/YaST2/README.md), but
    # upstream's own test suite always stubs it out for isolation; replicate that here.
    stub_const("Y2Packager::Repository", double("Y2Packager::Repository"))
    allow(Y2Packager::Repository).to receive(:all).and_return([])

    allow(Y2Storage::DumpManager.instance).to receive(:dump)

    if respond_to?(:architecture) # Match mocked architecture in Arch module
      # In a test, define a symbol :architecture accordingly:
      #   let(:architecture) { :aarch64 }
      allow(Yast::Arch).to receive(:x86_64).and_return(architecture == :x86_64)
      allow(Yast::Arch).to receive(:i386).and_return(architecture == :i386)
      allow(Yast::Arch).to receive(:ppc).and_return(architecture == :ppc)
      allow(Yast::Arch).to receive(:s390).and_return(architecture == :s390)
      allow(Yast::Arch).to receive(:aarch64).and_return(architecture == :aarch64)

      # If :storage_arch is defined, the Storage::Arch object is used instead of Yast::Arch.
      if respond_to?(:storage_arch)
        arch = Y2Storage::Arch.new(storage_arch)

        allow(Y2Storage::Arch).to receive(:new).and_return(arch)

        allow(storage_arch).to receive(:x86?).and_return(architecture == :x86)
        allow(storage_arch).to receive(:ppc?).and_return(architecture == :ppc)
        allow(storage_arch).to receive(:s390?).and_return(architecture == :s390)
      end
    end

    allow(Y2Storage::HWInfoReader.instance).to receive(:for_device)
      .and_return Y2Storage::HWInfoDisk.new

    # Bcache is only supported for x86_64 architecture. Probing the devicegraph complains if
    # Bcache is used with another architecture. Bcache error is avoided here. Otherwise,
    # x86_64 architecture must be set for every test using Bcache (which has demonstrated to
    # be quite error prone).
    #
    # This should be properly unmocked in the tests where real Bcache checking needs to be
    # performed (e.g., for ProbedDevicegraphChecker tests).
    allow_any_instance_of(Y2Storage::ProbedDevicegraphChecker)
      .to receive(:unsupported_bcache?).and_return(false)
  end

  # Some tests use ProposalSettings#new_for_current_product to initialize the settings. That
  # method sets some default values when there is not imported features (i.e., when
  # control.xml is not found).
  #
  # The product features could be modified during testing. Due to there are tests relying on
  # settings with pristine default values, it is necessary to reset the product features to
  # not interfere with other examples run in the same process.
  after(:context) do
    Yast::ProductFeatures.Import({})
  end
end
