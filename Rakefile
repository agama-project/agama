# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "shellwords"
require "fileutils"
require "yast/rake"

# Infers the gem name from the source code
#
# It searches for a gemspec to deduct the name.
#
# @param directory [String] sources directory
# @return [String,nil]
def gem_name_from(directory)
  gemspec = Dir.glob(File.join(directory, "*.gemspec")).first
  return nil unless gemspec

  gemspec_file = File.basename(gemspec)
  gemspec_file[/(.+)\.gemspec/, 1]
end

# Infers the package name from the source code
#
# @param directory [String] source directory
# @return [String,nil]
def package_name_from(directory)
  gem = gem_name_from(directory)
  return nil if gem.nil?

  "rubygem-#{gem}"
end

# Finds the gems in the source directory
#
# @param directory [String] source directory
# @return [<String>]
def find_gem(directory)
  name = gem_name_from(directory)
  Dir.glob(File.join(directory, "#{name}-*.gem"))
end

def live_iso?
  mount_out = `mount`
  # live medium uses overlay FS or device mapper for the root
  mount_out.match?(/^\w+ on \/ type overlay/) || mount_out.match?(/^\/dev\/mapper\/live-rw on \/ /)
end

Yast::Tasks.configuration do |conf|
  conf.obs_api = "https://api.opensuse.org"
  conf.obs_project = "systemsmanagement:Agama:Staging"
  conf.package_dir = File.join(Rake.original_dir, "package")
  conf.obs_target = "openSUSE_Tumbleweed"
  package_name = package_name_from(Rake.original_dir)
  conf.package_name = package_name if package_name
end

# Removes the "package" task to redefine it later.
Rake::Task["package"].clear
# Disables the osc:build
# Rake::Task["osc:build"].clear

# TODO: redefine :tarball instead of :package
desc "Prepare sources for rpm build"
task package: [] do
  Dir.chdir(Rake.original_dir) do |dir|
    old_gems = Dir.glob(File.join(package_dir, "*.gem"))
    FileUtils.rm(old_gems) unless old_gems.empty?
    name = gem_name_from(dir)
    sh "gem build #{name}.gemspec"
    gem = find_gem(dir).first
    gem2rpm = File.join(package_dir, "gem2rpm.yml")
    sh "gem2rpm --local --config #{gem2rpm} --template opensuse #{gem} > package/#{package_name}.spec"
    FileUtils.mv(gem, package_dir)
  end
end

SERVICES_DIR = "/usr/share/dbus-1/agama-services"

# support for patching by the yupdate script,
# only when running in the inst-sys or live medium
if ENV["YUPDATE_FORCE"] == "1" || File.exist?("/.packages.initrd") || live_iso?
  Rake::Task["install"].clear
  task :install do
    destdir = ENV["DESTDIR"] || "/"

    if ENV["YUPDATE_SKIP_BACKEND"] != "1"
      puts "Installing the DBus service..."
      Dir.chdir("service") do
        sh "gem build agama.gemspec"
        sh "gem install --local --force --no-format-exec --no-doc --build-root #{destdir.shellescape} agama-*.gem"

        # update the DBus configuration files
        FileUtils.mkdir_p(SERVICES_DIR)
        sh "cp share/org.opensuse.Agama*.service #{SERVICES_DIR}"
        sh "cp share/dbus.conf /usr/share/dbus-1/agama.conf"

        # update the systemd service file
        source_file = "share/systemd.service"
        target_file = "/usr/lib/systemd/system/agama.service"

        unless FileUtils.identical?(source_file, target_file)
          FileUtils.cp(source_file, target_file)
          sh "systemctl daemon-reload"
        end
      end
    end

    if ENV["YUPDATE_SKIP_FRONTEND"] != "1"
      puts "Installing the Web frontend..."
      Dir.chdir("web") do
        node_env = ENV["NODE_ENV"] || "production"
        sh "NODE_ENV=#{node_env.shellescape} make install"

        # clean up the extra files when switching the development/production mode
        if node_env == "production"
          # remove the uncompressed and development files
          FileUtils.rm_f(Dir.glob("/usr/share/cockpit/agama/index.{css,html,js}"))
          FileUtils.rm_f(Dir.glob("/usr/share/cockpit/agama/*.map"))
        else
          # remove the compressed files
          FileUtils.rm_f(Dir.glob("/usr/share/cockpit/agama/*.gz"))
        end
      end
    end

    # update also the tests if they are present in the system
    if ENV["YUPDATE_SKIP_TESTS"] != "1" && File.exist?("/usr/share/agama-playwright")
      puts "Installing the integration tests..."

      # we are installing into an empty chroot, make sure the target exists
      FileUtils.mkdir_p(File.join(destdir, "/usr/share"))
      FileUtils.cp_r("playwright/.", File.join(destdir, "/usr/share/agama-playwright"))
    end
  end
end
