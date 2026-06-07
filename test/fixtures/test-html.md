80端口被占用

  

首先使用命令来查询监听端口的进程

sudo lsof -i -P | grep -i "listen"

sudo lsof -iTCP:80 | grep LISTEN

  

osx自带apache http server，多半是这家伙了

  

* * *

sudo /usr/sbin/apachectl stop

这个可以关闭系统自带的apache

  

如果想彻底去掉它，则可以

launchctl unload -w /System/Library/LaunchDaemons/org.apache.httpd.plist

想打开就再load

  

* * *

注意80端口的监听是需要root权限的

  

可以这样运行来使webstorm获得root权限

sudo /Applications/WebStrom.app/Contents/MacOS/webstorm