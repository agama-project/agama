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
require "bootloader/exceptions"

describe Bootloader::UnsupportedBootloader do
  subject { described_class.new("exotic") }

  it "exposes the given bootloader name" do
    expect(subject.bootloader_name).to eq("exotic")
  end

  it "includes the bootloader name in the message" do
    expect(subject.message).to include("exotic")
  end
end

describe Bootloader::BrokenConfiguration do
  subject { described_class.new("something is wrong") }

  it "exposes the given reason" do
    expect(subject.reason).to eq("something is wrong")
  end

  it "includes the reason in the message" do
    expect(subject.message).to include("something is wrong")
  end
end

describe Bootloader::BrokenByPathDeviceName do
  subject { described_class.new("/dev/disk/by-path/foo") }

  it "exposes the given device name" do
    expect(subject.dev_name).to eq("/dev/disk/by-path/foo")
  end

  it "includes the device name in the message" do
    expect(subject.message).to include("/dev/disk/by-path/foo")
  end
end

describe Bootloader::UnsupportedOption do
  subject { described_class.new("some_option") }

  # NOTE: pre-existing upstream bug, confirmed identical in current yast2-bootloader master, not
  # fixed here (see service/YaST2/README.md "Known limitations"): #initialize assigns the given
  # option to @reason instead of @option, so the public #option reader (translated from
  # `attr_reader :option`) always returns nil instead of the value passed to .new. Nothing in
  # Agama's closure ever calls #option (only #message, via the rescue clause in Bootloader.rb),
  # so this has no practical effect, but is documented here rather than silently "fixed".
  it "does NOT expose the given option due to a pre-existing upstream bug " \
     "(#option is always nil)" do
    expect(subject.option).to be_nil
  end

  it "includes the option name in the message" do
    expect(subject.message).to include("some_option")
  end
end

describe Bootloader::InvalidSerialConsoleArguments do
  it "uses a default message when none is given" do
    expect(described_class.new.message).to include("Invalid serial console arguments")
  end

  it "accepts a custom message" do
    expect(described_class.new("custom reason").message).to include("custom reason")
  end

  it "is a kind of BrokenConfiguration" do
    expect(described_class.new).to be_a(Bootloader::BrokenConfiguration)
  end
end

describe Bootloader::NoRoot do
  it "is a RuntimeError" do
    expect(described_class.new).to be_a(RuntimeError)
  end
end
