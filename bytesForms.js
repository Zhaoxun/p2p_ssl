//处理bytes(Uint8Array)数据和字符串的互转，
//字符串可以为hex格式，也可以为base64及其变种
function fromHex(hexString) {
    if ( hexString.length%2 >0) hexString='0'+hexString;
    let bt = new Uint8Array(hexString.length/2);
    for (var i=0; i<hexString.length; i+=2){
        bt[i/2] = parseInt(hexString.slice(i,i+2), 16);
    }
    return  bt};

//https://www.codenong.com/cs109699503/
const b2Hex = (bytes) => bytes.reduce(  (str, byte) =>  str + byte.toString(16).padStart(2, '0'), '');

//https://juejin.cn/post/6844904088811880455
const b2Base64 = (bytes) => btoa( String.fromCharCode(...bytes) );

function fromBase64(base64){
    let bits = atob(base64);
    let bytes = new Uint8Array(bits.length);
    for (let i = 0; i < bits.length; i++) bytes[i] = bits.charCodeAt(i);
    return bytes;
}

const hex2Base64 = (hex) => btoa(fromHex(hex));

//阎兆珣采用的标准 [url's base64]<=>[standard base64]:
// *<=>+  -<=>/  .<=>=
const url2Base64 = (base64Url) => base64Url.replaceAll('*','+').
    replaceAll('-','/').replaceAll('.','=') ;

const base64toUrl = (base64) => base64.replaceAll('+','*').
    replaceAll('/','-').replaceAll('=','.') ;

function url2Lock(realUrl) {
    //url在@之后都是服务器发布的公钥(锁)，并且为url's base64形式，将其转为bytes
    let rawLock = realUrl.split('@')[1];
    return fromBase64( url2Base64(rawLock) );    
}

//export {fromHex, b2Hex, url2Lock};