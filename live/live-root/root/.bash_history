mount | cut -f3 -d" " | grep /mnt | sort -r | xargs -r umount; swapon --show=NAME --noheadings | grep -v zram | xargs -r swapoff
systemctl restart agama.service agama-web-server.service
less /var/log/YaST2/y2log
journalctl -u agama-web-server.service
journalctl -u agama.service
systemctl status agama-web-server.service
systemctl status agama.service
journalctl -t live-self-update
agama config show | jq
agama logs store
