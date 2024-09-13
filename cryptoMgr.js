//阎兆珣编写，用来统领ecdh和cbc的加密过程
//需要与bytesForms.js合用，在ecdh环节也需要用到axlsign.js


//【ecdh】

//自己的curve25519密钥，保存至MyEck，公钥base64存入sessionStorage
function genkey(){
    log('开始生成本机专用密钥...');
    let seed = new Uint8Array(32);
    try{
        crypto.getRandomValues(seed);    
    }catch(err){         
        alert('您的浏览器缺乏内置加密功能，请换个浏览器');        
        log('浏览器缺少网页程序依赖的WebCrypto库！整链路加密不可用,禁止向服务器发送私密消息。');
        return Promise.reject('');
    } 

    let MyEck = axlsign.generateKeyPair(seed);

    return MyEck;
}

//与从url中获取的服务器公钥混算，生成256bit的sharedSecret，存入sessionStorage
async function mingle(url){
//     console.log('url:', url);

     log('开始与最后端服务器调配整链路加密……');
     let ecdhKey; //javascript脑残，没法在try里面建立变量。
     try{
         ecdhKey = axlsign.sharedKey(MyEck.private, url2Lock(url));
     }catch(err){         
         log('混合密钥失败，请检查含有服务器公钥的网址是否正确！'+err.stack , true);
         return null;
     }
//     log(`ecdhKey ${ecdhKey}`);
     //防破解的混淆变换:
     let changed =new TextEncoder().encode( base64toUrl(b2Base64(ecdhKey)) );
//     log(`changed ${changed}`);
    let sha = await crypto.subtle.digest('SHA-256', changed);
//    log('sha:'+sha);
    let sharedSecret = b2Hex(new Uint8Array(sha));
    sessionStorage.setItem('sharedSecret', sharedSecret);     
                   
    localStorage.setItem('crypted',"true");
//    log(localStorage.crypted);
    log('已实现调配整链路加密。请勿用代码读取本页的共享密钥并告知他人');
 }

//用法： mingle(window.location.href);
// ------------------------------------------------------

//【aes-cbc】
var CBCkey;
var CBCiv;
var subtleKey;


async function initCBC(){
    let ss = sessionStorage.getItem('sharedSecret');
    if (ss===null){
        log('尚未完成与后端服务器调配整链路加密，请返回起始页',true);
        return null;
    }
    let b256 = fromHex(ss);
    if (b256.length != 32){
        log('共享密钥格式错误！请返回起始页', true);
        return null;
    }
    CBCkey = b256.slice(0,16);
    CBCiv = b256.slice(16,32);
    
    subtleKey = await crypto.subtle.importKey( 
     "raw", CBCkey,
      "aes-cbc","true", 
    ['encrypt','decrypt']);
    //CBCkey.buffer也是对的。范例在https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt 
    //在/importkey中没有.buffer也可以用。
    log('整链路加密程序就绪。');
    newStatus('整链路加密通信中');
    //加密有效期
    expire = Number( sessionStorage.expire )
    alertExpire('expire')    
}

//生成0-15范围的两个随机整数, 差值不小于3
function randomIndice(){
    let r = new Uint16Array(1);
    crypto.getRandomValues(r);
    let a = r%16;
    let b = r%16;
    while (a==b){
        crypto.getRandomValues(r);        
        b = r%16;
        if (a == b) continue;
        if (a>b & a-b<3) a = (a+3)%16;
        if (b>a & b-a<3) b = (b+3)%16;
    }
    
    if (b<a) [a, b] = [b, a];
    return [a,b];
}

// 根据randomIndice得出的索引对，从wholeiv中截取，并在之前充0
function genIV(indice){
    let lastHex = b2Hex( CBCiv.slice(indice[0], indice[1]));
    let frontHex = '0'.repeat(32-lastHex.length);    
    return fromHex(frontHex + lastHex);    
}

//检查aes_cbc加密是否可用
function if_aes_ready(){

    if (!(CBCkey)){
        log('缺乏具体加密需要的密码')
        return false
    }
    if (!(CBCiv)){
        log('缺乏具体加密需要的偏移量')
        return false
    }
    return true
};


//加密 bytes
async function encryptB( srcBytes, Indice){
    
    let ciphered = {'indice':Indice};

    let sha256 = await crypto.subtle.digest("SHA-256", srcBytes);
    ciphered.sha30 = b2Hex(new Uint8Array(sha256)).slice(0,30);    
    
    try{
       ciphered.raw = await crypto.subtle.encrypt(  { name: "AES-CBC", iv: genIV(Indice) }, subtleKey, srcBytes ); 
        ciphered.raw = new Uint8Array(ciphered.raw);
        return ciphered;
    }catch(err){
        log('加密核心函数出错了！具体为：'+err.stack ,true);
        return null;
    }  
}

//加密 string
async function encryptT( srcText, Indice ){    
    let data = new TextEncoder().encode(srcText);
    let ciphered = await encryptB(data, Indice);

    let ciphered_hex = b2Hex(ciphered.raw);
//    log('文本加密结果：'+ciphered_hex);
    let sh = ciphered.sha30;
    
//    encrypting = false;
    log('加密了一条文本消息.');
    return {sha30: sh, msg: ciphered_hex};
}
//加密 File 放在图片上传的js里

//解密 Bytes
async function decryptB(srcBytes, Indice, sha30){
    try{
        decrypted = await crypto.subtle.decrypt(  { name: "AES-CBC",iv: genIV(Indice)}, subtleKey, srcBytes )
//        console.log(decrypted)
        let sha256 = await crypto.subtle.digest("SHA-256", decrypted)
        let mysha30 = b2Hex(new Uint8Array(sha256)).slice(0,30)
//        console.log(`校验码对比 ${mysha30} ${sha30}`)
        
        if(sha30==mysha30) {
            return decrypted
        }else{
            log('解码后校验失败！')
            return false
        }        
        
    }catch{
        return false
   }
};

//解密 Text
async function decryptT ( srcHex, Indice, sha30 ) {

//    let decrypted = await crypto.subtle.decrypt(  { name: "AES-CBC",iv: genIV(Indice)}, subtleKey, fromHex(srcHex) );
    
    let decrypted = await decryptB( fromHex(srcHex), Indice, sha30)
    
    if(decrypted==false){
        log(`解密失败了！id=${sessionStorage.myLock}, indice=${Indice}, 需要解码内容=${srcHex}`, true)
        return false
    }

    try{
        let text = new TextDecoder().decode(decrypted)
        log('解密了一条文本消息。')
        return text
    }catch(err){
        log(`解密在转文字时出错了！id=${sessionStorage.myLock}, indice=${Indice}, 需要解码内容=${srcHex}`, true)
    }
};



// ------------------------------------------------------

//【杂项工具函数】

//https://zhuanlan.zhihu.com/p/53382478
function copy(DOMnode){
    window.getSelection().selectAllChildren(DOMnode);
    document.execCommand ("Copy");
};








