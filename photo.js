//从photoShrink.html提取的对文件压缩函数，注意document.getElementById(里面)所需要的网页控件：
//加载的文件大小 <span id='filedata'></span>
//文件大小限额区，内部必须是数字 id='maxsize'
//允许裁边的位置，照抄四个单选钮
//压缩按钮，触发yasuo函数, 以下是输出
//压缩尺度比=<span id='ratio'></span>
//<canvas id='cvs' width="800" height="600" style='border:1px black solid'></canvas>
//<div id='shrinkReport' class="textbox" 

function yasuo(fileLoc){
    let maxsize
    try{
      maxsize = Number( document.getElementById('maxsize').innerText )  //value还是innerText
    }catch{
      log('未从网页元素id="maxsize"获取合法的文件大小限额，无法开始压缩')
      return
    }     
    initShrink(fileLoc,maxsize)
};

function readFileData(e){ //对input file绑定 .onchange = (e)=>
    let file = e.target.files[0]
    console.log('file:', file)
    document.getElementById('filedata').innerText = `待压缩文件名=${file.name} 文件大小=${file.size}字节`    
};

    
function shrink2canvas(fileLoc, canvasLoc,
                          compressRatio=[1,2], 
                          leftH=true, topH=true,
                          doLast = ()=>{}){
    
    let file = document.getElementById(fileLoc).files[0]
    let blobURL = URL.createObjectURL(file)
    let img = new Image()
    img.src = blobURL
    let cvs = document.getElementById(canvasLoc)
    document.getElementById('ratio').innerText=
        `${compressRatio[0]}/${compressRatio[1]}`
    console.log(`尺度压缩比=${compressRatio[0]}/${compressRatio[1]}`)
    
    img.onload = ()=>{

        let lostWidth = img.width %compressRatio[1]
        let lostHeight = img.height %compressRatio[1]        
        
        let oldWidth = img.width - lostWidth
        let oldHeight = img.height - lostHeight            
        let newWidth =  oldWidth *compressRatio[0] /compressRatio[1]
        let newHeight = oldHeight *compressRatio[0] /compressRatio[1]           
        let left=0, top=0     
        if(leftH) left = lostWidth//裁掉左边
        if(topH)  top = lostHeight //裁掉上边
        
        cvs.width = newWidth
        cvs.height = newHeight
        
        let canvas = cvs.getContext("2d")        
        canvas.drawImage(img, 
                      left, top, oldWidth, oldHeight, 
                     0,0, newWidth, newHeight)
        doLast()//启动下一个函数，这么写纯粹因为这里是无法return结果的
        
    }  
    
};
    
    
function clear(canvasLoc){
    let cvs = document.getElementById(canvasLoc)
    let canvas = cvs.getContext("2d") 
    canvas.clearRect(0,0, cvs.width, cvs.height)
    cvs.width = 300
    cvs.height = 400
};

var tempJpeg; 
function canvas2jpeg(canvasLoc, doLast=()=>{}){
    let cvs = document.getElementById(canvasLoc)
    cvs.toBlob( (blob)=>{
        tempJpeg = blob
        console.log(`图片已经保存到tempJpeg! 大小为${tempJpeg.size}`)
        doLast()
    },  
    
    "image/jpeg",0.95)
};


var shrinkRatios =[
    [5,6], [4,5], [3,4], [2,3], [3,5], 
    [1,2], [2,5], [1,3], [1,4], [1,5], [1,6]
];
    
var shrinkNumbers = shrinkRatios.map(e => e[0]/e[1]);
    
var shrinkTarget = {fileLoc:'in', size:10240, 
                    left:true, up:true, large2small:null, ready:false}; 
    //起到函数循环时的控制作用，因为JS的异步禁止函数传出返回值，所以只能在异步的第二步把控制变量保存到这个变量内。

function checkShrink(ratioIndex){ 
    //循环调用   > shrink2canvas -> canvas2jpeg->checkShrink-
    if (shrinkTarget.large2small==null){ //起始位置，压缩第一遍后的检查，由于过小的再检查    
        if(tempJpeg.size ==shrinkTarget.size){
            doneShrink()
                        
        }else if(tempJpeg.size >shrinkTarget.size){
            
            if (ratioIndex ==shrinkNumbers.length-1){ //已经无法再小了
                document.getElementById('shrinkReport').innerText =
                    `使用了最低的压缩率，文件大小依然为${tempJpeg.size}，请选个小点的文件再进行上传！`
            }else{//可以由大到小进行试凑
                shrinkTarget.large2small=true
                console.log('进入从大到小压缩试凑')
                setTimeout(checkShrink,50, ratioIndex) //再检查一遍，到下面的else if里
            }

        }else{ //<的情况
            if (ratioIndex == 0){//第一个压缩比就够用，不用再小了
                doneShrink()             
                
            }else{ //不要从小到大寻找，这里简单化处理，如果小了，就跳到大的尺度比试验
                let nextIndex = Math.max(0, ratioIndex-2)
                console.log(`${ratioIndex}号压缩结果小于限额，尝试更少压缩比${nextIndex}号`)
                setTimeout(shrink2canvas, 250,
                  shrinkTarget.fileLoc, 'cvs',
                  shrinkRatios[nextIndex], 
                    shrinkTarget.left, shrinkTarget.up,
                  ()=>canvas2jpeg('cvs', ()=>checkShrink(nextIndex) )
                )               
            }      
            
        }
           
    }else if (shrinkTarget.large2small==true){ //从大到小找压缩比，遇到文件占用空间小于限额立即停止
        if ( tempJpeg.size >shrinkTarget.size ){ //上一轮压得不够小
            
            if(ratioIndex == shrinkNumbers.length-1){
                document.getElementById('shrinkReport').innerText =
            `使用了最低的压缩率，文件大小依然为${tempJpeg.size}，请选个小点的文件再进行上传！`
                
            }else{ //没到头就试更小的一个压缩比
                console.log(`文件还不够小，需要尝试更小的压缩比`)
                setTimeout(shrink2canvas, 250,
                  shrinkTarget.fileLoc, 'cvs',
                  shrinkRatios[ratioIndex+1], 
                    shrinkTarget.left, shrinkTarget.up,
                  ()=>canvas2jpeg('cvs', ()=>checkShrink(ratioIndex+1) )
                )                
            }
            
        }else{ //原来大，现在已经不大了
            doneShrink()                       
        }
    } //不需要考虑shrinkTarget.large2small==false，不做从小到大的寻找            
    
};


    
function doneShrink(){
    let filename = document.getElementById(shrinkTarget.fileLoc).files[0].name
     //https://www.cnblogs.com/sunliyuan/p/13925124.html
     tempJpeg.name = filename.substring(0, filename.lastIndexOf('.')) + '_.jpeg' //稍微修改了一下文件名
    
    shrinkTarget.ready = true
    document.getElementById('shrinkReport').innerText =
    `已经达到了保存图像质量的最少压缩量，图片文件已备好！文件占用空间${tempJpeg.size}`     
    afterShrink() 
};

function afterShrink(){};//这个必须在调用initShrink之前改写，一般是允许上传文件了。
    
function gaugeShrink(osize, maxsize){ //纯数学推算，估计用shrinkRatio第几位合适
    let size 
    let i = 0
    while (i<shrinkNumbers.length) {
        let r = shrinkNumbers[i]
        size = osize * r * r
        if(size <= maxsize){break}
        i++
    }
    if(i==0){
        return 0
    }else{
        return i-1 //保证不会取到最后一位，而且刚开始取的值反而会让压缩后超过原大小
    }    
};


function initShrink(fileLoc, maxsize){ //压缩逻辑入口处

    let osize
    let compare
    try{
        osize = document.getElementById(fileLoc).files[0].size
        compare = (osize <= maxsize)
    }catch{
        alert('请输入正确的文件上传位置，以及合法的文件占用空间限额！')
        return
    }
    if(compare){ //已经符合要求，不用压缩        
        tempJpeg = document.getElementById(fileLoc).files[0]
        shrink2canvas(fileLoc, 'cvs', [1,1])        
        document.getElementById('shrinkReport').innerText =
        '无需压缩，图片文件已备好！' 
        afterShrink()
        return
    }

    //压缩前准备
    shrinkTarget.fileLoc =  fileLoc
    shrinkTarget.ready = false 
    shrinkTarget.large2small = null
    document.getElementById('LR').value=='l'? shrinkTarget.left=true: shrinkTarget.left=false
    document.getElementById('UD').value=='u'? shrinkTarget.up=true: shrinkTarget.up=false

    shrinkTarget.size = maxsize    
    gaugeIndex = gaugeShrink(osize, maxsize)    
    console.log(`初始使用的压缩编号为${gaugeIndex}`)
    
    //首轮压缩
    setTimeout(shrink2canvas, 50,
      shrinkTarget.fileLoc, 'cvs',
      shrinkRatios[gaugeIndex], 
        shrinkTarget.left, shrinkTarget.up,
      ()=>canvas2jpeg('cvs', ()=>checkShrink(gaugeIndex) )
    ) 
};    