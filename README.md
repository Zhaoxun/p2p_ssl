# p2p_ssl
peer to peer ssl [client webpage]-[proxy site]-[my back server] How to encrypt the messages from [client webpage] to [my back server], this is part of the answer.

The problem with simple https is either it encrypts [client webpage]-[proxy site] or [proxy site]-[my back server] so the messages are always transparent to [proxy site]. A manual ssl from the very front end to the very backend is therefore essential. However, the client must know my public key in the beginning may proxy site sent a fake public key and deciphers whatever client sends to me before pretending the client to send its own message to me(middle man attack). I prevent this attack by publishing the entry html with public key written in url.

My project covers simple json message communication, and file uploading encrypted (not yet file downloading). Because the real scenario only needs image files and the size of it is limited, I added photo shrink functionality. This is very useful nowadays since cellphones tend to save larger and larger pictures with unnecessary resolution. 

Only webpage part is published. demo*.html files make a very great tutorial on how it works , without real server code or net connection. Although the language is Chinese, I guarantee you full understanding if you follow the `/demo_walkthrough` pictures.

## File Descriptions
#### css
common.css

#### javascript
common.js - display functions related to common.css
axlsign.js - curve X25519 ecdh key swap (from github)
bytesForms.js - deal with transfermation between bytes and string formats 
cryptoMgr.js - core SSL programs
file.js - uploading files encrypted 
photo.js - shrink image files within given size

#### html
/demo
demo_ecdh_server.html
demo_cbc_server.html
demo_ecdh.html - mock client, entry point
demo_cbc.html - mock client, from the bottom link of demo_ecdh.html
 - see screenshots in folder 'demo_walkthrough'

/text
text_ecdh.html - actual entry point is like 
`https://xx.xx/yan/text@cD4ivSkz9OCGDdLLvXmkYlRLXe16tDTdVZieWUOvDlA.`

text_cbc.html
- to run these two, you need a proper server program, which is not open here.

/file
file_ecdh.html
file_cbc.html - upload an image given key is shared between here and server, and it shrinks photo before uploading
- to run these two, you need a proper server program, which is not open here.

/photo
photoShrink.html - a standalone webpage to shrink image files to below given size

/bug
bug_report.html

## Real Installation Hint for Server

1. you can run demo*.html on your local machine and see how SSL between a mock client and a mock server(webpage) is established and employed
   
2. the real server on the proxy must set up a proxy like these in nginx:


```
upstream yan{    
    ip_hash;
    server [Your Backend Server IP]:9999; 
}

   server {
       listen       443 ssl http2;
       listen       [::]:443 ssl http2;
       ......

        location /yan/ {
            root /var/;  #
            rewrite ^(.*)/text@(.*)$ $1/text_ecdh.html break;
            rewrite ^(.*)/fecdh@(.*)$ $1/file_ecdh.html break;
         }

        location /yan/msg/ {
            proxy_pass http://yan/msg/; #to upstream yan
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $remote_addr;
        }

        location /yan/file/ {
            proxy_pass http://yan/file/; #to upstream yan
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $remote_addr;
        }
  }
 
```
and you also need to put all html files in this folder: `/var/yan/` on the proxy site/server.

## Special Thanks
1.  [axlsign.js](https://github.com/wavesplatform/curve25519-js/blob/master/axlsign.js)
