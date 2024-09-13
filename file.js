//专门处理文件上传，加密部分需要与cryptoMgr和bytesForms一起用

async function upload_(url, fileinform){
    //基础的文件上传，以Form的形式
    try{
        re=await fetch(url,{method: 'POST', 
//            'Content-Type': 'application/x-www-form-urlencoded',
                            body:fileinform})
    }catch(err){
        log('请求发送失败，可能是网站故障' ,true)
        Sending.inProcess = false
        return Promise.reject(1)
//https://blog.csdn.net/qq_39207948/article/details/85050687
    }
    if(re.status != 200){
        log(`服务器报错：${re.status} ${re.statusText}`)
        if (re.status == 404){
            log('服务器可能不开机')
            return Promise.reject(re.status)
        }else{
            setTimeout(Sending.abort, 500)
        }
        
    }    
    
    if(re.status == 500){        
        log(`错误码${re.status}  请求位置=${url} 发送类型=${Sending.purpose} 本地公钥=${sessionStorage.myLock}`, true)     
        return Promise.reject(re.status)
    }    
    
    msg = await re.json()
    

    if(re.status > 300){
        let errtext = 'N.A.'
        if (typeof msg.detail=='string'){
            errtext = msg.detail
        }else if (msg.detail instanceof Object){
            errtext = JSON.stringify(msg.detail)
        }else if (msg.detail instanceof Array){ 
            let errmsg = msg.detail[0]
            delete errmsg.ctx
            errtext = JSON.stringify(errmsg)
        }else{
            errtext = `${msg}`
        }
        
        if (re.status >399 && re.status <499){//400-499客户端自己的问题
            if(errtext.slice(0,8)=='bantime:'){
                let unbantime = transBantime(errtext)
                log(`错误码${re.status} 请求过频,被封至 ${unbantime}`)
            }else{
                log(`错误码${re.status} 被服务器拒绝原因 ${errtext}`) 
            }   
        }else{
            log(`错误码${re.status} 被服务器拒绝原因 ${errtext} 请求位置=${url} 发送类型=${fileinform.purpose} 本地公钥=${sessionStorage.myLock}`, true)
        } 
        
        return Promise.reject(re.status)
    }else{
        return msg      
    }  
};

let done_notice; //需要在上传前予以赋值一个无变量函数，即上传成功后如何表达出来。

function upload1(url, file, filetype, 
                  purpose, additional,
                  partNum, partTotal, 
                  encryptIndice,sha30){
    let data = new FormData()
    data.append('filetype', filetype)
    data.append('purpose', purpose)
    data.append('additional', JSON.stringify(additional) ) 
    data.append('partNum', partNum)
    data.append('partTotal', partTotal)
    data.append('encryptIndice', encryptIndice)
    data.append('sha30', sha30)

    data.append('file', bytes2file(file) ) 
//    console.log('file:', data.file)

    if(partNum == 'none'){
        log(`向服务器申请取消文件上传；如果很长时间未响应，可以刷新页面重试上传`)
    }else{
        log(`上传 ${partNum}/${partTotal} `)
    }
    
//    console.log(`file = ${file.slice(0,5)}`)
//    let begin5 = b2Hex( file.slice(0,5) )
//    console.log(`${partNum}/${partTotal} ${encryptIndice} 前5个字节为${begin5}`)
    
    upload_( url, data).
    then((reply)=>{
//3）对第一部分进行传输，有三种结果：成功，重传，或者放弃。服务器对此部分解密后进行检查，如果重传2次还未成功则放弃，放弃进入黑名单，10分钟内不得上传。自己也进行检查。        
        if (reply.order == 'done'){
//4）成功之后，延时调用传输下一部分，或者已经到头了，就结束，打开互斥锁。
            Sending.inProcess=false
            log('文件上传成功！')
            done_notice()
            
        }else if(reply.order == 'next'){
            Sending.failures = 0
            setTimeout( Sending.onepart, 10, partNum)
            
        }else if(reply.order == 'retry'){            
            log(`此分片上传出错，已经出错${reply.error_sum}次。过多出错会被暂时封禁。`)
            Sending.failures += 1
            if (Sending.failures ==2){
                log(`放弃对本文件的上传。请检查网络环境，避免在乘坐交通工具时使用本网页`)
                Sending.abort()
            }else{
                setTimeout( Sending.onepart, 500, partNum-1)
            }
            
        }else if(reply.order == 'abort'){
            Sending.inProcess = false
            log(`服务器已经清除了之前上传的文件部分，可以开始新的上传。`)
        }
    } )
    
};

async function file2bytes(file){
    let Array = await file.arrayBuffer()
    let bytes = new Uint8Array(Array)
    return bytes 
};

function bytes2file(bytesblob){
    let realtype = Object.prototype.toString.call(bytesblob).slice(8,-1);
    if (realtype == 'Uint8Array'){
        let t1 = new Blob([bytesblob], {type:'xxx/xxx'})
//        let t2 = new File([t1], '0.jpg', {type:"image/jpeg"})
        return t1
    }else{
        return bytesblob
    }    
};



const Sending = {
    inProcess: false, 
    url: '', 
    purpose: '',
    type: '',
    additional:{},
    parts: [],
    np: 0,
    failures: 0,

    
    start: async function(url,blob, purpose, additional){
        //1）接收文件，确认大小（预处理压缩），拆分暂存，开始互斥锁。
        if (this.inProcess){
            log('有文件在上传中，请等待其结束！')
            return Promise.reject(1)
        }
        if (blob==undefined){
            log('文件未选中！')
            return Promise.reject(1)
        }
        this.inProcess= true

        this.purpose = purpose
        this.additional = additional
        this.url = url
        let name = blob.name
//        log(`将要上传的文件名为${name}`)
        
        this.type = name.slice(name.lastIndexOf('.')+1, )
        this.failures = 0
        this.parts = []
        
        
        let whole = await file2bytes(blob)
//        this.whole = whole
        let chunkSize = 524200 //略小于512K        
        let start = 0
        let total = whole.length
        while (start<total ){
            if (start+chunkSize >= total){
                this.parts.push( whole.slice(start, total) )
                break
            }else{
                this.parts.push( whole.slice(start, start+chunkSize) )
                start += chunkSize
             } 
        } 
        this.np = this.parts.length
        log(`文件${name}，长度为${total}字节，已经被切分为${this.np}份`)
        
        setTimeout( Sending.onepart, 10, 0)
        
    },
        
    onepart: function(currentIndex){
        //alert(`part ${currentIndex} gets Called!`)

        let indice = randomIndice()
//        console.log('type',Sending.type)
        
        encryptB(Sending.parts[currentIndex], indice).
        then((ciphered)=>{
            if(ciphered){                
                upload1(Sending.url, 
                        ciphered.raw, Sending.type,
                        Sending.purpose, Sending.additional,
                        currentIndex+1, Sending.np, 
                        indice, ciphered.sha30)
            }else{
                return Promise.reject(1)
            }
        })
        
    }, 

    abort: function(){
        let empty = new Uint8Array([0])
        upload1(Sending.url, 
                empty, Sending.type,
                Sending.purpose, Sending.additional,
                'none', Sending.np, 
                ',', 'ff')        
    }
};

function get_file_type(DivID, check=false){
    let file = document.getElementById(DivID).files[0]
    let name = file.name
    let filetype = name.slice(name.lastIndexOf('.')+1, )
    if (check){
        if ( filetype!='jpg' && filetype!='jpeg' && filetype!='png'){
            return false
        }
    }
    return filetype
};