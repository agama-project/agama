systemctl restart agama.service agama-web-server.service && sleep 2
less /var/log/YaST2/y2log
journalctl -u agama-web-server.service
journalctl -u agama.service
systemctl status agama-web-server.service
systemctl status agama.service
agama config show | jq
agama logs store
