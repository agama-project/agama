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

Yast::Tasks.configuration do |conf|
  conf.obs_api = "https://api.opensuse.org"
  conf.obs_project = "YaST:Head:D-Installer"
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
    sh "gem2rpm --config #{gem2rpm} --template opensuse #{gem} > package/#{package_name}.spec"
    FileUtils.mv(gem, package_dir)
  end
end

SERVICES_DIR = "/usr/share/dbus-1/d-installer-services"

# support for patching by the yupdate script,
# only when running in the inst-sys or live medium
if File.exist?("/.packages.initrd") || `mount`.match?(/^[\w]+ on \/ type overlay/)
  Rake::Task["install"].clear
  task :install do
    if ENV["YUPDATE_SKIP_BACKEND"] != "1"
      destdir = ENV["DESTDIR"] || "/"

      puts "Installing the DBus service..."
      Dir.chdir("service") do
        sh "gem build d-installer.gemspec"
        sh "gem install --local --force --no-format-exec --no-doc --build-root #{destdir.shellescape} d-installer-*.gem"

        # update the DBus configuration files
        FileUtils.mkdir_p(SERVICES_DIR)
        sh "cp share/org.opensuse.DInstaller*.service #{SERVICES_DIR}"
        sh "cp share/dbus.conf /usr/share/dbus-1/d-installer.conf"

        # update the systemd service file
        source_file = "share/systemd.service"
        target_file = "/usr/lib/systemd/system/d-installer.service"

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
          FileUtils.rm_f(Dir.glob("/usr/share/cockpit/d-installer/index.{css,html,js}"))
          FileUtils.rm_f(Dir.glob("/usr/share/cockpit/d-installer/*.map"))
        else
          # remove the compressed files
          FileUtils.rm_f(Dir.glob("/usr/share/cockpit/d-installer/*.gz"))
        end
      end
    end
  end
end
