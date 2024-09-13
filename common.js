// 处理common.css中的显示
//
var MAX_LOG_LINES = 12;
var n_logs = 3;

// 计算实际高度:
function calc_logger(n){
    h = n  * 1.5;
    n_logs = n;
    return String(h)+'em';
}


//显示底栏 默认3行
function reset_footer(){
  document.body.style.setProperty('--barheight', '1.5em' );
  document.body.style.setProperty('--lgheight', calc_logger(3) );
  document.getElementById('show_footer').style.setProperty(
      'visibility','hidden');       
}

// 隐藏底栏，包括footbar和logger
function hide_footer(){
    document.body.style.setProperty('--barheight', '0'); 
    document.body.style.setProperty('--lgheight', '0'); 
    n_logs = 0; 
    document.getElementById('show_footer').style.setProperty(
        'visibility','visible');
}

function maximize_footer(){
    document.body.style.setProperty('--lgheight', calc_logger(12) );
}

function increase_footer(){
    if (n_logs<MAX_LOG_LINES)  document.body.style.setProperty(
        '--lgheight', calc_logger(n_logs+3) );
}

function decrease_footer(){
    if (n_logs>3)  document.body.style.setProperty(
             '--lgheight', calc_logger(n_logs-3) );             
}

//改写顶栏状态
function newStatus(str){
    document.getElementById("status").innerHTML = '&emsp;' + str;
}

function getUser(){
    if (sessionStorage.userID){
        return sessionStorage.userID
    }
    
    return 'N.A.'    
};

function reportBug(){
    if (localStorage.currentErr){
        window.open('./bug_report.html', '_blank')
    }else{
        alert('请勿重复报错！')
    }
};


//函数将需要的记录的文字给刷入logger模块
function log(msg, err=false){
    if(err) {
        localStorage.setItem('currentErr', msg);
        localStorage.setItem('currentUser', getUser());
        msg = "<p style='color:orange;'><b>错误：</b>" + msg +
            "&emsp;<button class='btn' onclick='reportBug()'>我要报错</button></p>";
    }else{
        msg += '<br>';
    }       
    
    let logger = document.getElementById("logger");
    logger.innerHTML += msg;
    logger.scrollTop = logger.scrollHeight;    
};

//更改按钮的可用性
var BtnColors={};
    
function disableBtn(buttonLoc){
    let btn = document.getElementById(buttonLoc)
    btn.disabled = 'true'
    BtnColors[buttonLoc] = getComputedStyle(btn).backgroundColor
    btn.style = 'background-color:grey;'   
};
    
function renableBtn(buttonLoc){
    let btn = document.getElementById(buttonLoc)
    btn.disabled = ''
    btn.style = `background-color:${BtnColors[buttonLoc]};`
};


function pathURL(){
        let current = window.location.href
        let index = current.lastIndexOf('/')
        return current.slice(0, index)
    };        

var baseurl =  './msg';

function transBantime(str){
    //str = 'bantime:1721272368.0238206'
    let timestamp = Number( str.slice(8,-1) )*1000 //8位以后是时间戳, *1000是因为python的单位是秒，而JS单位是毫秒
    let utc = (new Date(timestamp) )
    let repr = `${utc.toLocaleDateString()} ${utc.toLocaleTimeString()}`
    repr += " +0~30’" //服务器自己的误差
    return repr    
};

//加密有效期提示
let expire;
function setExpire(maxageSecs){
    let t = ~~(Date.now()/1000) + maxageSecs
    expire = t
    sessionStorage.setItem('expire', String(t))
    alertExpire('expire')
};

function alertExpire(divID){
    let left = expire - ~~(Date.now()/1000)
    if(left > 0){
        let minutes = ~~(left/60)
        let seconds = left - minutes*60
        let secdigits = String(seconds).padStart(2,'0')
        
        document.getElementById(divID).innerText=
            `${minutes}:${secdigits}`
        setTimeout(alertExpire, 400, divID)
    }else {
        newStatus('端到端加密已过期！')
        document.getElementById(divID).innerText=''
        log('由于端到端加密已过期, 请关闭页面！')
    }
};


async function put(url, json){ //替fetch擦屁股
    let jsonFmt = {'Content-Type': 
                   'application/json;charset=utf-8' }
    let text = JSON.stringify(json)
    let re
    try{
        re=await fetch(url,{method: 'PUT', body:text, headers:jsonFmt})
    }catch(err){
        log('请求发送失败，可能是网站不可达' ,true)
        return Promise.reject(1)
//https://blog.csdn.net/qq_39207948/article/details/85050687
    }   
    log(`服务器回复的标题：${re.status} ${re.statusText}`)
    if(re.status == 500){
       if(sessionStorage.myLock) {
            text +=' id='+sessionStorage.myLock}
        log(`错误码${re.status} 请求位置=${url}/PUT 发送消息=${text}`, true)  
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
            if(sessionStorage.myLock) {
                text +=' id='+sessionStorage.myLock}
            log(`错误码${re.status} 被服务器拒绝原因 ${errtext} 请求位置=${url} 发送消息=${text}`, true)
        } 
        
        return Promise.reject(re.status)
    }else{
        return msg      
    }    
};

async function get(url){
    let re
    try{
        re=await fetch(url,{method: 'GET'})
    }catch(err){
        log('请求发送失败，可能是网站不可达' ,true)
        return Promise.reject(1)
//https://blog.csdn.net/qq_39207948/article/details/85050687
    }   
    log(`服务器回复的标题：${re.status} ${re.statusText}`)
    if (re.status==500){
        log(`服务器出现不明原因的故障`)
    }
    if (re.status==404){
        log(`请求位置${url}  服务器可能宕机了`)  
    }
    
    msg = await re.json()
    if (re.status>300){
        let errtext = msg.detail
        if(errtext.slice(0,8)=='bantime:'){
            let unbantime = transBantime(errtext)
            log(`错误码${re.status} 请求过频,被封至 ${unbantime}`)
        }
       return Promise.reject(re.status) 
    }else{
       return msg 
    }         
};
