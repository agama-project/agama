# frozen_string_literal: true

require "yast"
require "date"
require "shellwords"

module Bootloader
  # Responsibility of class is to manage backup of MBR, respective PBR of disk,
  # respective partition.
  class BootRecordBackup
    include Yast::Logger
    BASH_PATH = Yast::Path.new(".target.bash")
    BASH_OUTPUT_PATH = Yast::Path.new(".target.bash_output")
    TARGET_SIZE = Yast::Path.new(".target.size")
    MAIN_BACKUP_DIR = "/var/lib/YaST2/backup_boot_sectors/"
    KEPT_BACKUPS = 10

    attr_reader :device

    # Exception from this class
    class Error < RuntimeError; end

    # Exception used to indicate that backup missing, so any action with it is
    # not possible
    class Missing < Error
      def initialize
        super "Backup for boot record missing."
      end
    end

    # Create backup handling class for given device
    # @param device[String] expect kernel name of device like "/dev/sda"
    def initialize(device)
      @device = device
    end

    # Write fresh backup of MBR or PBR of given device.
    # Backup is stored in /var/lib/YaST2/backup_boot_sectors, in logs
    # directory and if it is MBR of primary disk, then also in /boot/backup_mbr
    def write
      Yast::SCR.Execute(BASH_PATH, "/usr/bin/mkdir -p #{MAIN_BACKUP_DIR.shellescape}")

      if exists?
        rotate
        reduce_backup_count
      end

      copy_br(device, device_file_path)

      # save MBR to yast2 log directory
      logs_path = "/var/log/YaST2/#{device_file}"
      copy_br(device, logs_path)
    end

    # Restore backup
    # @raise [::Bootloader::BootRecordBackup::Missing] if backup missing
    # @return true if copy is successful
    def restore
      raise Missing unless exists?

      # Copy only 440 bytes for Vista booting problem bnc #396444
      # and also to not destroy partition table
      copy_br(device_file_path, device, block_size: 440) == 0
    end

  private

    def device_file
      @device_file ||= @device.tr("/", "_")
    end

    def device_file_path
      @device_file_path ||= MAIN_BACKUP_DIR + device_file
    end

    def exists?
      Yast::SCR.Read(TARGET_SIZE, device_file_path) > 0
    end

    # Get last change time of file
    # @param [String] filename string name of file
    # @return [String] last change date as YYYY-MM-DD-HH-MM-SS
    def formated_file_ctime(filename)
      stat = Yast::SCR.Read(Yast::Path.new(".target.stat"), filename)
      ctime = stat["ctime"] or raise(Error, "Cannot get modification time of file #{filename}")
      time = DateTime.strptime(ctime.to_s, "%s")

      time.strftime("%Y-%m-%d-%H-%M-%S")
    end

    def copy_br(device, target_path, block_size: 512)
      Yast::SCR.Execute(
        BASH_PATH,
        "/bin/dd if=#{device.shellescape} of=#{target_path.shellescape} " \
        "bs=#{block_size.to_s.shellescape} count=1 2>&1"
      )
    end

    def reduce_backup_count
      files = Yast::SCR.Read(Yast::Path.new(".target.dir"), MAIN_BACKUP_DIR)
      # clean only backups for this device
      files.select! do |c|
        c =~ /#{Regexp.escape(device_file)}-\d{4}(?:-\d{2}){5}/
      end
      # and sort so we can benefit from its ascending order
      files.sort!
      files.drop(KEPT_BACKUPS).each do |file_name|
        Yast::SCR.Execute(
          Yast::Path.new(".target.remove"),
          MAIN_BACKUP_DIR + file_name
        )
      end
    end

    def rotate
      # move it so we do not overwrite it
      change_date = formated_file_ctime(device_file_path)
      Yast::SCR.Execute(
        BASH_PATH,
        format("/bin/mv %{path} %{path}-%{date}",
          path: device_file_path.shellescape, date: change_date.shellescape)
      )
    end
  end
end
