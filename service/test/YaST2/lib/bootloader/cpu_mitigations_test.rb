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

# NOTE: this file has no upstream test at all, so this spec was written from scratch while
# vendoring, based on reading the real source (see service/YaST2/README.md).

require_relative "../../../test_helper"
require "bootloader/cpu_mitigations"
require "cfa/grub2/default"

describe Bootloader::CpuMitigations do
  # Real CFA::Grub2::Default::KernelParams instance (not a double), built from a raw kernel
  # command line string - exercises the actual parsing/serialization logic too.
  def kernel_params_for(line)
    CFA::Grub2::Default::KernelParams.new(line, "whatever")
  end

  describe ".from_kernel_params" do
    it "returns a :nosmt instance for 'auto,nosmt'" do
      result = described_class.from_kernel_params(kernel_params_for("mitigations=auto,nosmt"))
      expect(result.value).to eq(:nosmt)
    end

    it "returns an :auto instance for 'auto'" do
      result = described_class.from_kernel_params(kernel_params_for("mitigations=auto"))
      expect(result.value).to eq(:auto)
    end

    it "returns an :off instance for 'off'" do
      result = described_class.from_kernel_params(kernel_params_for("mitigations=off"))
      expect(result.value).to eq(:off)
    end

    it "returns a :manual instance when the parameter is missing" do
      result = described_class.from_kernel_params(kernel_params_for("quiet"))
      expect(result.value).to eq(:manual)
    end

    it "raises for an unrecognized value" do
      expect { described_class.from_kernel_params(kernel_params_for("mitigations=bogus")) }
        .to raise_error(RuntimeError, /Unknown mitigations value/)
    end
  end

  describe ".from_string" do
    it "returns an instance with the corresponding symbol value" do
      expect(described_class.from_string("auto").value).to eq(:auto)
    end

    it "raises for an unrecognized string" do
      expect { described_class.from_string("bogus") }
        .to raise_error(RuntimeError, /Unknown mitigations value/)
    end
  end

  describe "#to_human_string" do
    it "returns the human-readable label for the value" do
      expect(described_class.new(:auto).to_human_string).to eq("Auto")
      expect(described_class.new(:nosmt).to_human_string).to eq("Auto + No SMT")
      expect(described_class.new(:off).to_human_string).to eq("Off")
      expect(described_class.new(:manual).to_human_string).to eq("Manually")
    end
  end

  describe "#kernel_value" do
    it "returns the corresponding kernel command line value" do
      expect(described_class.new(:auto).kernel_value).to eq("auto")
      expect(described_class.new(:nosmt).kernel_value).to eq("auto,nosmt")
      expect(described_class.new(:off).kernel_value).to eq("off")
    end

    it "raises for the :manual value (it has no kernel command line representation)" do
      expect { described_class.new(:manual).kernel_value }.to raise_error(RuntimeError)
    end
  end

  describe "#modify_kernel_params" do
    let(:kernel_params) { kernel_params_for("mitigations=auto quiet") }

    it "removes any existing mitigations parameter" do
      described_class.new(:off).modify_kernel_params(kernel_params)

      expect(kernel_params.parameter("mitigations")).to eq("off")
    end

    context "when the value is :manual" do
      it "does not add a new mitigations parameter" do
        described_class.new(:manual).modify_kernel_params(kernel_params)

        expect(kernel_params.parameter("mitigations")).to eq(false)
      end
    end

    context "when the value is not :manual" do
      it "adds the corresponding mitigations parameter" do
        described_class.new(:off).modify_kernel_params(kernel_params)

        expect(kernel_params.serialize).to include("mitigations=off")
      end
    end

    it "does not affect other kernel parameters" do
      described_class.new(:off).modify_kernel_params(kernel_params)

      expect(kernel_params.parameter("quiet")).to eq(true)
    end
  end

  describe "ALL" do
    it "contains one instance per known value" do
      expect(described_class::ALL.map(&:value)).to contain_exactly(:nosmt, :auto, :off, :manual)
    end
  end

  describe "DEFAULT" do
    it "is the :auto value" do
      expect(described_class::DEFAULT.value).to eq(:auto)
    end
  end
end
