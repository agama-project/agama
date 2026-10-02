# frozen_string_literal: true

# Vendored from yast2-bootloader's test/boot_record_backup_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/boot_record_backup"

Yast.import "BootStorage"

BASH_PATH = Yast::Path.new(".target.bash")
SIZE_PATH = Yast::Path.new(".target.size")
DIR_PATH = Yast::Path.new(".target.dir")
STAT_PATH = Yast::Path.new(".target.stat")

describe Bootloader::BootRecordBackup do
  include_context "yast2-bootloader test setup"

  subject { Bootloader::BootRecordBackup.new("/dev/sda") }

  describe "#restore" do
    it "returns true if backup is successfully restored" do
      allow(Yast::SCR).to receive(:Read).with(SIZE_PATH, anything).and_return(10)
      expect(Yast::SCR).to receive(:Execute).with(BASH_PATH,
        /bin\/dd.* if=\/var\/lib\/YaST2\/backup_boot_sectors/)
        .and_return(0)

      expect(subject.restore).to be true
    end

    it "returns false if copying backup failed" do
      allow(Yast::SCR).to receive(:Read).with(SIZE_PATH, anything).and_return(10)
      expect(Yast::SCR).to receive(:Execute).with(BASH_PATH,
        /bin\/dd.* if=\/var\/lib\/YaST2\/backup_boot_sectors/)
        .and_return(1)

      expect(subject.restore).to be false
    end

    it "raise ::Bootloader::BootRecordBackup::Missing exception if there is not backup for " \
       "device BR" do
      allow(Yast::SCR).to receive(:Read).with(SIZE_PATH, anything).and_return(0)
      expect { subject.restore }.to raise_error(::Bootloader::BootRecordBackup::Missing)
    end
  end

  describe "#write" do
    before do
      allow(Yast::SCR).to receive(:Execute).with(BASH_PATH, /mkdir/)
      allow(Yast::SCR).to receive(:Execute).with(BASH_PATH, /bin\/dd/)
      allow(Yast::SCR).to receive(:Read).with(SIZE_PATH, anything).and_return(0)
    end

    it "store backup of device first 512 bytes to /var/log/YaST2" do
      expect(Yast::SCR).to receive(:Execute).with(BASH_PATH, /bin\/dd.* of=\/var\/log\/YaST2/)
      subject.write
    end

    it "store backup of device first 512 bytes to /var/lib/YaST2/backup_boot_sectors" do
      expect(Yast::SCR).to receive(:Execute).with(BASH_PATH,
        /bin\/dd.* of=\/var\/lib\/YaST2\/backup_boot_sectors/)
      subject.write
    end

    it "writes /var/lib/YaST2/backup_boot_sectors if it do not exists" do
      expect(Yast::SCR).to receive(:Execute).with(BASH_PATH,
        /mkdir.* \/var\/lib\/YaST2\/backup_boot_sectors/)
      subject.write
    end

    it "move old backup in backup_boot_sectors to copy with timestamp" do
      allow(Yast::SCR).to receive(:Read).with(SIZE_PATH, anything).and_return(10)
      allow(Yast::SCR).to receive(:Read).with(DIR_PATH, anything).and_return([])
      allow(Yast::SCR).to receive(:Read).with(STAT_PATH, anything).and_return("ctime" => 200)
      expect(Yast::SCR).to receive(:Execute).with(BASH_PATH,
        /bin\/mv .*backup_boot_sectors.*\s+.*backup_boot_sectors/)

      subject.write
    end

    it "keep only ten backups in backup_boot_sectors" do
      # special backup format, leaked implementation to test
      file_names = Array.new(11) { |i| format("_dev_sda-1970-01-01-00-03-%02d", i) }
      allow(Yast::SCR).to receive(:Read).with(SIZE_PATH, anything).and_return(10)
      allow(Yast::SCR).to receive(:Read).with(DIR_PATH, anything).and_return(file_names)
      allow(Yast::SCR).to receive(:Read).with(STAT_PATH, anything).and_return("ctime" => 200)
      allow(Yast::SCR).to receive(:Execute).with(BASH_PATH,
        /bin\/mv .*backup_boot_sectors.*\s+.*backup_boot_sectors/)
      expect(Yast::SCR).to receive(:Execute).with(Yast::Path.new(".target.remove"),
        /.*backup_boot_sectors.*/)

      subject.write
    end
  end
end
