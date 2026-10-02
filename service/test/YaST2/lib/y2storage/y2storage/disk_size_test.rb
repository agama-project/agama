#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016] SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage/disk_size"

describe Y2Storage::DiskSize do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts
  let(:zero) { Y2Storage::DiskSize.zero }
  let(:unlimited) { Y2Storage::DiskSize.unlimited }
  let(:one_byte) { Y2Storage::DiskSize.new(1) }

  describe ".new" do
    context "when no param is passed" do
      it "creates a disk size of 0 bytes" do
        expect(described_class.new.size).to eq(0)
      end
    end

    context "when a number is passed" do
      context "and is a natural number" do
        it "creates a disk size with this number of bytes" do
          expect(described_class.new(5).size).to eq(5)
        end
      end

      context "and is a floating point number" do
        it "creates a disk size with a rounded number of bytes" do
          expect(described_class.new(5.6).size).to eq(6)
          expect(described_class.new(5.4).size).to eq(5)
        end
      end
    end

    context "when a string is passed" do
      it "creates a disk size with the number of bytes represented by the string" do
        expect(described_class.new("5").size).to eq(5)
        expect(described_class.new("15 KB").size).to eq(15 * 1000)
        expect(described_class.new("15 MiB").size).to eq(15 * (1024**2))
        expect(described_class.new("23 TiB").size).to eq(23 * (1024**4))
        expect(described_class.new("23.2 KiB").size).to eq((23.2 * 1024).round)
      end
    end
  end

  describe ".B" do
    it "creates a disk size from a number of bytes" do
      expect(described_class.B(5).size).to eq(5)
    end
  end

  describe ".KiB" do
    it "creates a disk size from a number of KiB" do
      expect(described_class.KiB(5).size).to eq(5 * 1024)
    end
  end

  describe ".MiB" do
    it "creates a disk size from a number of MiB" do
      expect(described_class.MiB(5).size).to eq(5 * (1024**2))
    end
  end

  describe ".GiB" do
    it "creates a disk size from a number of GiB" do
      expect(described_class.GiB(5).size).to eq(5 * (1024**3))
    end
  end

  describe ".TiB" do
    it "creates a disk size from a number of TiB" do
      expect(described_class.TiB(5).size).to eq(5 * (1024**4))
    end
  end

  describe ".PiB" do
    it "creates a disk size from a number of PiB" do
      expect(described_class.PiB(5).size).to eq(5 * (1024**5))
    end
  end

  describe ".EiB" do
    it "creates a disk size from a number of EiB" do
      expect(described_class.EiB(5).size).to eq(5 * (1024**6))
    end
  end

  describe ".ZiB" do
    it "creates a disk size from a number of ZiB" do
      expect(described_class.ZiB(5).size).to eq(5 * (1024**7))
    end
  end

  describe ".YiB" do
    it "creates a disk size from a number of YiB" do
      expect(described_class.YiB(5).size).to eq(5 * (1024**8))
    end
  end

  describe ".KB" do
    it "creates a disk size from a number of KB" do
      expect(described_class.KB(5).size).to eq(5 * 1000)
    end
  end

  describe ".MB" do
    it "creates a disk size from a number of MB" do
      expect(described_class.MB(5).size).to eq(5 * (1000**2))
    end
  end

  describe ".GB" do
    it "creates a disk size from a number of GB" do
      expect(described_class.GB(5).size).to eq(5 * (1000**3))
    end
  end

  describe ".TB" do
    it "creates a disk size from a number of TB" do
      expect(described_class.TB(5).size).to eq(5 * (1000**4))
    end
  end

  describe ".PB" do
    it "creates a disk size from a number of PB" do
      expect(described_class.PB(5).size).to eq(5 * (1000**5))
    end
  end

  describe ".EB" do
    it "creates a disk size from a number of EB" do
      expect(described_class.EB(5).size).to eq(5 * (1000**6))
    end
  end

  describe ".ZB" do
    it "creates a disk size from a number of ZB" do
      expect(described_class.ZB(5).size).to eq(5 * (1000**7))
    end
  end

  describe ".YB" do
    it "creates a disk size from a number of YB" do
      expect(described_class.YB(5).size).to eq(5 * (1000**8))
    end
  end

  describe ".to_human_string" do
    context "when has a specific size" do
      it("returns human-readable string represented in the biggest possible unit") do
        expect(described_class.B(5 * (1024**0)).to_human_string).to eq("5.00 B")
        expect(described_class.B(5 * (1024**1)).to_human_string).to eq("5.00 KiB")
        expect(described_class.B(5 * (1024**3)).to_human_string).to eq("5.00 GiB")
        expect(described_class.B(5 * (1024**4)).to_human_string).to eq("5.00 TiB")
        expect(described_class.B(5 * (1024**7)).to_human_string).to eq("5.00 ZiB")
      end
    end

    context "when has unlimited size" do
      it "returns 'unlimited'" do
        expect(described_class.unlimited.to_human_string).to eq("unlimited")
      end
    end
  end

  describe ".human_floor" do
    context "when it has a specific size" do
      it("returns human-readable string not exceeding the actual size") do
        expect(described_class.B(4095 * (1024**0)).human_floor).to eq("3.99 KiB")
        expect(described_class.B(4095 * (1024**3)).human_floor).to eq("3.99 TiB")
      end
    end

    context "when it has unlimited size" do
      it "returns 'unlimited'" do
        expect(described_class.unlimited.human_floor).to eq("unlimited")
      end
    end
  end

  describe ".human_ceil" do
    context "when it has a specific size" do
      it("returns human-readable string not exceeding the actual size") do
        expect(described_class.B(4097 * (1024**0)).human_ceil).to eq("4.01 KiB")
        expect(described_class.B(4097 * (1024**3)).human_ceil).to eq("4.01 TiB")
      end
    end

    context "when it has unlimited size" do
      it "returns 'unlimited'" do
        expect(described_class.unlimited.human_ceil).to eq("unlimited")
      end
    end
  end

  describe "#+" do
    it "should accept addition of another DiskSize" do
      disk_size = Y2Storage::DiskSize.GiB(10) + Y2Storage::DiskSize.GiB(20)
      expect(disk_size.to_i).to be == 30 * (1024**3)
    end
    it "should accept addition of an int" do
      disk_size = Y2Storage::DiskSize.MiB(20) + 512
      expect(disk_size.to_i).to be == (20 * (1024**2)) + 512
    end
    it "should accept addition of a string with a valid disk size spec" do
      disk_size = Y2Storage::DiskSize.MiB(20) + "512 KiB"
      expect(disk_size.to_i).to be == (20 * (1024**2)) + (512 * 1024)
    end
    it "should refuse addition of a random string" do
      expect { Y2Storage::DiskSize.MiB(20) + "Foo Bar" }
        .to raise_exception TypeError
    end
    it "should refuse addition of another type" do
      expect { Y2Storage::DiskSize.MiB(20) + true }
        .to raise_exception TypeError
    end
  end

  describe "#-" do
    it "should accept subtraction of another DiskSize" do
      disk_size = Y2Storage::DiskSize.GiB(20) - Y2Storage::DiskSize.GiB(5)
      expect(disk_size.to_i).to be == 15 * (1024**3)
    end
    it "should accept subtraction of an int" do
      disk_size = Y2Storage::DiskSize.KiB(3) - 1024
      expect(disk_size.to_i).to be == 2048
    end
    it "should accept subtraction of a string with a valid disk size spec" do
      disk_size = Y2Storage::DiskSize.MiB(20) - "512 KiB"
      expect(disk_size.to_i).to be == (20 * (1024**2)) - (512 * 1024)
    end
    it "should refuse subtraction of a random string" do
      expect { Y2Storage::DiskSize.MiB(20) + "Foo Bar" }
        .to raise_exception TypeError
    end
    it "should refuse subtraction of another type" do
      expect { Y2Storage::DiskSize.MiB(20) - true }
        .to raise_exception TypeError
    end
  end

  describe "#%" do
    it "should accept another DiskSize" do
      disk_size = Y2Storage::DiskSize.KiB(2) % Y2Storage::DiskSize.KB(1)
      expect(disk_size.to_i).to be == 48
    end
    it "should accept an int" do
      disk_size = Y2Storage::DiskSize.KiB(4) % 1000
      expect(disk_size.to_i).to be == 96
    end
    it "should accept a string with a valid disk size spec" do
      disk_size = Y2Storage::DiskSize.MiB(20) % "100 KB"
      expect(disk_size.to_i).to be == 20 * (1024**2) % (100 * 1000)
    end
    it "should refuse a random string" do
      expect { Y2Storage::DiskSize.MiB(20) % "Foo Bar" }
        .to raise_exception TypeError
    end
    it "should refuse another type" do
      expect { Y2Storage::DiskSize.MiB(20) % true }
        .to raise_exception TypeError
    end
  end

  describe "#*" do
    it "should accept multiplication with an int" do
      disk_size = Y2Storage::DiskSize.MiB(12) * 3
      expect(disk_size.to_i).to be == 12 * (1024**2) * 3
    end
    it "should accept multiplication with a float" do
      disk_size = Y2Storage::DiskSize.B(10) * 4.5
      expect(disk_size.to_i).to be == 45
    end
    it "should refuse multiplication with a string" do
      expect { Y2Storage::DiskSize.MiB(12) * "100" }
        .to raise_exception TypeError
    end
    it "should refuse multiplication with another DiskSize" do
      expect { Y2Storage::DiskSize.MiB(12) * Y2Storage::DiskSize.MiB(3) }
        .to raise_exception TypeError
    end
  end

  describe "#/" do
    it "should accept division by an int" do
      disk_size = Y2Storage::DiskSize.MiB(12) / 3
      expect(disk_size.to_i).to be == 12 / 3 * (1024**2)
    end
    it "should accept division by a float" do
      disk_size = Y2Storage::DiskSize.B(10) / 2.5
      expect(disk_size.to_i).to be == 4
    end
    it "should refuse division by a string" do
      expect { Y2Storage::DiskSize.MiB(12) / "100" }
        .to raise_exception TypeError
    end
    it "should refuse division by another type" do
      expect { Y2Storage::DiskSize.MiB(20) / true }
        .to raise_exception TypeError
    end
    # DiskSize / DiskSize should be possible, returning an int,
    # but we haven't needed it so far.
  end

  describe "arithmetic operations with unlimited and DiskSize" do
    unlimited = Y2Storage::DiskSize.unlimited
    disk_size = Y2Storage::DiskSize.GiB(42)
    it "should return unlimited" do
      expect(unlimited + disk_size).to be == unlimited
      expect(disk_size + unlimited).to be == unlimited
      expect(unlimited - disk_size).to be == unlimited
      expect(disk_size - unlimited).to be == unlimited
      # DiskSize * DiskSize and DiskSize / DiskSize are undefined
    end
  end

  describe "arithmetic operations with unlimited and a number" do
    unlimited = Y2Storage::DiskSize.unlimited
    number    = 7
    it "should return unlimited" do
      expect(unlimited + number).to be == unlimited
      expect(unlimited - number).to be == unlimited
      expect(unlimited * number).to be == unlimited
      expect(unlimited / number).to be == unlimited
    end
  end

  describe "#power_of?" do
    context "when the number of bytes is power of the given value" do
      it "returns true" do
        expect(8.MiB.power_of?(2)).to be(true)
        expect(100.KB.power_of?(10)).to be(true)
      end
    end

    context "when the number of bytes is not power of the given value" do
      it "returns false" do
        expect(8.MiB.power_of?(10)).to be(false)
        expect(100.KB.power_of?(2)).to be(false)
      end
    end

    context "when the size is zero" do
      it "returns false" do
        expect(described_class.zero.power_of?(0)).to be(false)
        expect(described_class.zero.power_of?(1)).to be(false)
        expect(described_class.zero.power_of?(2)).to be(false)
        expect(described_class.zero.power_of?(5)).to be(false)
      end
    end

    context "when the size is unlimited" do
      let(:disk_size) { unlimited }

      it "returns false" do
        expect(described_class.unlimited.power_of?(0)).to be(false)
        expect(described_class.unlimited.power_of?(1)).to be(false)
        expect(described_class.unlimited.power_of?(2)).to be(false)
        expect(described_class.unlimited.power_of?(5)).to be(false)
      end
    end
  end

  describe "comparison" do
    disk_size1 = Y2Storage::DiskSize.GiB(24)
    disk_size2 = Y2Storage::DiskSize.GiB(32)
    disk_size3 = Y2Storage::DiskSize.GiB(32)
    it "operator < should compare correctly" do
      expect(disk_size1 < disk_size2).to be == true
      expect(disk_size2 < disk_size3).to be == false
    end
    it "operator > should compare correctly" do
      expect(disk_size1 > disk_size2).to be == false
      expect(disk_size2 > disk_size3).to be == false
    end
    it "operator == should compare correctly" do
      expect(disk_size2 == disk_size3).to be == true
    end
    it "operator != should compare correctly" do
      expect(disk_size1 != disk_size2).to be == true
    end
    it "operator <= should compare correctly" do
      expect(disk_size2 <= disk_size3).to be == true
    end
    it "operator >= should compare correctly" do
      expect(disk_size2 >= disk_size3).to be == true
    end
    it "operators (via <=>) should not compare with incompatible types" do
      expect { disk_size1 <=> true }
        .to raise_exception TypeError
    end
    # Comparing with an integer (#to_i) seems to make sense,
    # but we haven't needed it so far.
  end

  describe "comparison with unlimited" do
    unlimited = Y2Storage::DiskSize.unlimited
    disk_size = Y2Storage::DiskSize.GiB(42)
    it "should compare any disk size correctly with unlimited" do
      expect(disk_size).to be < unlimited
      expect(disk_size).to_not be > unlimited
      expect(disk_size).to_not eq unlimited
    end
    it "should compare unlimited correctly with any disk size" do
      expect(unlimited).to be > disk_size
      expect(unlimited).to_not be < disk_size
      expect(unlimited).to_not eq disk_size
    end
    it "should compare unlimited correctly with unlimited" do
      expect(unlimited).to_not be > unlimited
      expect(unlimited).to_not be < unlimited
      expect(unlimited).to eq unlimited
    end
  end

  describe ".parse" do
    it "should work with just a number" do
      expect(described_class.parse("0").to_i).to eq(0)
      expect(described_class.parse("7").to_i).to eq(7)
      expect(described_class.parse("7.00").to_i).to eq(7)
    end

    it "should also accept signed numbers" do
      expect(described_class.parse("-12").to_i).to eq(-12)
      expect(described_class.parse("+12").to_i).to eq(+12)
    end

    it "should work with integer and unit" do
      expect(described_class.parse("42 GiB").to_i).to eq(42 * (1024**3))
      expect(described_class.parse("-42 GiB").to_i).to eq(-42 * (1024**3))
    end

    it "should work with float and unit" do
      expect(described_class.parse("43.00 GiB").to_i).to be == 43 * (1024**3)
      expect(described_class.parse("-43.00 GiB").to_i).to be == -43 * (1024**3)
    end

    it "should work with non-integral numbers and unit" do
      # avoid float rounding issues, so do not use ==
      expect((described_class.parse("43.456 GB").to_i - (43.456 * (1000**3))).abs).to be < 1000
      expect((described_class.parse("-43.456 GB").to_i + (43.456 * (1000**3))).abs).to be < 1000
    end

    it "should work with integer and unit without space between them" do
      expect(described_class.parse("10MiB").to_i).to eq(10 * (1024**2))
    end

    it "should work with float and unit without space between them" do
      expect(described_class.parse("10.00MiB").to_i).to eq(10 * (1024**2))
    end

    it "should tolerate more embedded whitespace" do
      expect(described_class.parse("44   MiB").to_i).to eq(44 * (1024**2))
    end

    it "should tolerate more surrounding whitespace" do
      expect(described_class.parse("   45   TiB  ").to_i).to eq(45 * (1024**4))
      expect(described_class.parse("  46   ").to_i).to eq(46)
    end

    it "should accept \"unlimited\"" do
      expect(described_class.parse("unlimited").to_i).to eq(-1)
    end

    it "should accept \"unlimited\" with surrounding whitespace" do
      expect(described_class.parse("  unlimited ").to_i).to eq(-1)
    end

    it "should accept International System units" do
      expect(described_class.parse("10 KB").to_i).to eq(10 * 1000)
      expect(described_class.parse("10 MB").to_i).to eq(10 * (1000**2))
    end

    it "should accept deprecated units" do
      expect(described_class.parse("10 K").to_i).to eq(10 * 1000)
      expect(described_class.parse("10 M").to_i).to eq(10 * (1000**2))
      expect(described_class.parse("10 G").to_i).to eq(10 * (1000**3))
    end

    it "should not be case sensitive" do
      expect(described_class.parse("10k").to_i).to eq(10 * 1000)
      expect(described_class.parse("10Kb").to_i).to eq(10 * 1000)
    end

    context "when using the legacy_unit flag" do
      let(:legacy) { true }

      it "considers international system units to be power of two" do
        expect(described_class.parse("10 MB", legacy_units: legacy).size).to eq(10 * (1024**2))
      end

      it "considers deprecated units to be power of two" do
        expect(described_class.parse("10 M", legacy_units: legacy).to_i).to eq(10 * (1024**2))
      end

      it "reads units that are power of two in the usual way" do
        expect(described_class.parse("10 MiB", legacy_units: legacy).size).to eq(10 * (1024**2))
      end
    end

    it "should accept #to_s output" do
      expect(described_class.parse(described_class.GiB(42).to_s).to_i).to eq(42 * (1024**3))
      expect(described_class.parse(described_class.new(43).to_s).to_i).to eq(43)
      expect(described_class.parse(described_class.zero.to_s).to_i).to eq(0)
      expect(described_class.parse(described_class.unlimited.to_s).to_i).to eq(-1)
    end

    it "should accept #to_human_string output" do
      expect(described_class.parse(described_class.GiB(42).to_human_string).to_i)
        .to eq(42 * (1024**3))
      expect(described_class.parse(described_class.new(43).to_human_string).to_i).to eq(43)
      expect(described_class.parse(described_class.zero.to_human_string).to_i).to eq(0)
      expect(described_class.parse(described_class.unlimited.to_human_string).to_i).to eq(-1)
    end

    it "should reject invalid input" do
      expect { described_class.parse("wrglbrmpf") }.to raise_error(TypeError)
      expect { described_class.parse("47 00 GiB") }.to raise_error(TypeError)
      expect { described_class.parse("0FFF MiB") }.to raise_error(TypeError)
    end
  end

  describe ".parse_or" do
    it "parses the given value" do
      size = described_class.parse_or("10GiB", Y2Storage::DiskSize.unlimited)
      expect(size).to eq(described_class.new("10GiB"))
    end

    context "when an invalid value is given" do
      it "returns the fallback" do
        size = described_class.parse_or("GiB", Y2Storage::DiskSize.unlimited)
        expect(size).to eq(Y2Storage::DiskSize.unlimited)
      end
    end
  end

  describe "#ceil" do
    # Use 31337 bytes (prime) to ensure we don't success accidentally
    let(:rounding) { Y2Storage::DiskSize.new(31337) }

    it "returns the same value if any of the operands is zero" do
      expect(zero.ceil(rounding)).to eq zero
      expect(4.MiB.ceil(zero)).to eq 4.MiB
      expect(zero.ceil(zero)).to eq zero
    end

    it "returns the same value if any of the operands is unlimited" do
      expect(unlimited.ceil(rounding)).to eq unlimited
      expect(8.GiB.ceil(unlimited)).to eq 8.GiB
      expect(unlimited.ceil(zero)).to eq unlimited
      expect(unlimited.ceil(unlimited)).to eq unlimited
    end

    it "returns the same value when rounding to 1 byte" do
      expect(4.KiB.ceil(one_byte)).to eq 4.KiB
    end

    it "returns the same value when it's divisible by the size" do
      value = rounding * 4
      expect(value.ceil(rounding)).to eq value
    end

    it "rounds up to the next divisible size otherwise" do
      value = rounding * 4
      value -= one_byte
      expect(value.ceil(rounding)).to eq(rounding * 4)

      value -= Y2Storage::DiskSize.new(337)
      expect(value.ceil(rounding)).to eq(rounding * 4)

      value -= rounding / 2
      expect(value.ceil(rounding)).to eq(rounding * 4)

      value = (rounding * 3) + one_byte
      expect(value.ceil(rounding)).to eq(rounding * 4)
    end
  end

  describe "#floor" do
    # Use 31337 bytes (prime) to ensure we don't success accidentally
    let(:rounding) { Y2Storage::DiskSize.new(31337) }

    it "returns the same value if any of the operands is zero" do
      expect(zero.floor(4.MiB)).to eq zero
      expect(4.MiB.floor(zero)).to eq 4.MiB
      expect(zero.floor(zero)).to eq zero
    end

    it "returns the same value if any of the operands is unlimited" do
      expect(unlimited.floor(8.GiB)).to eq unlimited
      expect(8.GiB.floor(unlimited)).to eq 8.GiB
      expect(unlimited.floor(zero)).to eq unlimited
      expect(unlimited.floor(unlimited)).to eq unlimited
    end

    it "returns the same value when rounding to 1 byte" do
      expect(4.KiB.floor(one_byte)).to eq 4.KiB
    end

    it "returns the same value when it's divisible by the size" do
      value = rounding * 3
      expect(value.floor(rounding)).to eq value
    end

    it "rounds down to the previous divisible size otherwise" do
      value = rounding * 3
      value += one_byte
      expect(value.floor(rounding)).to eq(rounding * 3)

      value += rounding / 2
      expect(value.floor(rounding)).to eq(rounding * 3)

      value += Y2Storage::DiskSize.new(200)
      expect(value.floor(rounding)).to eq(rounding * 3)

      value = (rounding * 4) - one_byte
      expect(value.floor(rounding)).to eq(rounding * 3)
    end
  end
end
