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
  it "is a BootloaderError" do
    expect(described_class.new).to be_a(Bootloader::BootloaderError)
  end
end

describe Bootloader::BootloaderError do
  it "inherits from RuntimeError" do
    expect(described_class.new).to be_a(RuntimeError)
  end
end

describe Bootloader::CommandError do
  let(:status) { double(exitstatus: 1) }
  let(:cheetah) { Cheetah::ExecutionFailed.new(["/usr/bin/cmd", "--arg"], status, "stdout", "error output") }
  subject { described_class.new("Command failed", cheetah) }

  it "is a BootloaderError" do
    expect(subject).to be_a(Bootloader::BootloaderError)
  end

  it "exposes description, command, stderr, and exit_code" do
    expect(subject.description).to eq("Command failed")
    expect(subject.command).to eq(["/usr/bin/cmd", "--arg"])
    expect(subject.stderr).to eq("error output")
    expect(subject.exit_code).to eq(1)
  end

  it "formats a readable message with command and stderr" do
    expect(subject.message).to include("Command failed")
    expect(subject.message).to include("[\"/usr/bin/cmd\", \"--arg\"]")
    expect(subject.message).to include("error output")
  end
end

describe Bootloader::GrubInstallError do
  it "is a CommandError" do
    status = double(exitstatus: 1)
    cheetah = Cheetah::ExecutionFailed.new(["/usr/sbin/grub2-install"], status, "", "err")
    err = described_class.new(cheetah)

    expect(err).to be_a(Bootloader::CommandError)
    expect(err.message).to include("Installing GRUB2 to device failed")
  end
end

describe Bootloader::GrubConfigError do
  it "is a CommandError" do
    status = double(exitstatus: 1)
    cheetah = Cheetah::ExecutionFailed.new(["/usr/sbin/grub2-mkconfig"], status, "", "err")
    err = described_class.new(cheetah)

    expect(err).to be_a(Bootloader::CommandError)
    expect(err.message).to include("Generating GRUB2 configuration failed")
  end
end

describe Bootloader::DracutError do
  it "is a CommandError" do
    status = double(exitstatus: 1)
    cheetah = Cheetah::ExecutionFailed.new(["/usr/bin/dracut"], status, "", "err")
    err = described_class.new(cheetah)

    expect(err).to be_a(Bootloader::CommandError)
    expect(err.message).to include("Regenerating initrd with dracut failed")
  end
end

describe Bootloader::SdbootutilError do
  it "is a CommandError" do
    status = double(exitstatus: 1)
    cheetah = Cheetah::ExecutionFailed.new(["/usr/bin/sdbootutil"], status, "", "err")
    err = described_class.new("Action failed", cheetah)

    expect(err).to be_a(Bootloader::CommandError)
    expect(err.message).to include("Action failed")
  end
end
