#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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

require "y2storage/proposal/autoinst_size_parser"

describe Y2Storage::Proposal::AutoinstSizeParser do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    Y2Storage::StorageManager.create_test_instance
  end

  subject(:parser) { described_class.new(settings) }

  let(:settings) do
    instance_double(Y2Storage::ProposalSettings, volumes: volumes, format: :ng)
  end

  let(:volumes) do
    [
      Y2Storage::VolumeSpecification.new(
        "mount_point" => "swap", "min_size" => "128MiB", "max_size" => "1GiB", "weight" => 50
      )
    ]
  end

  MIN = Y2Storage::DiskSize.parse("512MB").freeze
  MAX = Y2Storage::DiskSize.parse("2GB").freeze

  before do
    Y2Storage::VolumeSpecification.clear_cache
  end

  describe "#parse" do
    context "when size is empty" do
      it "sets min_value to the given minimal value" do
        size_info = parser.parse("", "/", MIN, MAX)
        expect(size_info.min).to eq(MIN)
      end

      it "sets max_value as given maximal value" do
        size_info = parser.parse("", "/", MIN, MAX)
        expect(size_info.max).to eq(Y2Storage::DiskSize.unlimited)
      end

      it "sets percentage and weight to nil" do
        size_info = parser.parse("", "/", MIN, MAX)
        expect(size_info.percentage).to be_nil
        expect(size_info.weight).to be_nil
      end
    end

    context "when size is 'auto'" do
      context "and min and max are defined in the control file for the given mount point" do
        it "sets min and max according to control file values" do
          size_info = parser.parse("auto", "swap", MIN, MAX)
          expect(size_info.min).to eq(128.MiB)
          expect(size_info.max).to eq(1.GiB)
          expect(size_info.percentage).to be_nil
        end

        it "sets weight according to control file value" do
          size_info = parser.parse("auto", "swap", MIN, MAX)
          expect(size_info.weight).to eq(50)
        end
      end

      context "and min and max are not defined in the control file for the given mount point" do
        let(:volumes) { [] }

        it "returns nil" do
          expect(parser.parse("auto", "/srv", MIN, MAX)).to be_nil
        end

        context "and mount point is 'swap'" do
          it "sets min and max values to 512MiB and 2GiB" do
            size_info = parser.parse("auto", "swap", MIN, MAX)
            expect(size_info.min).to eq(512.MiB)
            expect(size_info.max).to eq(2.GiB)
          end
        end
      end

      context "and there are no volumes defined in the control file" do
        let(:subvolumes) { [] }

        it "returns nil" do
          expect(parser.parse("auto", "/srv", MIN, MAX)).to be_nil
        end
      end
    end

    context "when size is nil" do
      it "returns nil" do
        expect(parser.parse("auto", nil, MIN, MAX)).to be_nil
      end
    end
  end
end
