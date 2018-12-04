'use strict';
$(function(){
  var browserMeta = {
    isChromiumBased: /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent)
  };

  var ready = false;
  if(typeof(Worker) === "undefined") {
    alert("Sorry but this program requires the Worker class, and your browser doesn't seem to support this class.");

    return;
  }

  const NUKECODE_REGEX = /^([a-z])\-([0-9])$/i;
  const KEYWORD_REGEX = /^[a-zA-Z\?\_]{9,16}$/;

  function alluniq(str)
  {
    var used = {},i;
    for(i=0;i<str.length;i++)
    {
      if(str[i]=="?" || str[i]=="_") {
        continue;
      }
      if(!used[str[i]])
      {
        used[str[i]] = true;
      } else
      {
        return false;
      }
    }
    return true;
  }

  function isValidKeywordFilter(k)
  {
    return KEYWORD_REGEX.test(k) && alluniq(k);
  }

  function isCodeDuplicate(code_id)
  {
    var used = $("input[name=kCode"+code_id+"]").val().substr(0,1),code;
    for(var i=0;i<8;i++)
    {
      if(i==code_id) continue;
      code = $("input[name=kCode"+i+"]").val().substr(0,1);
      if(used == code)
      {
        return true;
      }
    }
    return false;
  }

  function areCodesGood()
  {
    var code;
    var used = {};
    for(var i=0;i<8;i++)
    {
      code = $("input[name=kCode"+i+"]").val().substr(0,1);
      if(used[code])
      {
        return false;
      }
      used[code] = true;
    }
    return true;
  }

  function isValidNukeCode(field,tid)
  {
    return NUKECODE_REGEX.test(field.val()) && !isCodeDuplicate(tid) && parseInt(field.val().substr(2))<10;
  }

  function updateProgress(curr,max)
  {
    if(curr==0 && max==0) {
      $("#progressPercent").html("--.-%")
      $(".progbar").attr("state","ready");
      $(".progbar > .proginner").width("100%");
      return;
    } else {
      $(".progbar").attr("state","inprogress");
    }
    var pct = (curr/max)*100;
    $("#progressPercent").html(`${curr}/${max} ${(Math.floor(pct*10)/10).toFixed(1)}%`)
    $(".progbar > .proginner").width(Math.floor(pct*100)/100+"%");
    if(curr==max) {
      $(".progbar").attr("state","done");
    }
  }

  function processCode(code)
  {
      var origCode = "";
      var i,cde;
      var repoCode = "";
      for(i=0;i<8;i++)
      {
        cde = $("input[name=kCode"+i+"]").val().substr(2)
        origCode += !isNaN(parseInt(cde,10))?cde:i.toString();
      }

      for(i=0;i<8;i++)
      {
        repoCode += origCode[parseInt(code[i],10)];
      }

      return repoCode;
  }

  function getEncodedAnagram()
  {
    var i,eAnagram = "";
    for(i=0;i<8;i++)
    {
      eAnagram += $("input[name=kCode"+i+"]").val().substr(0,1);
    }
    return eAnagram;
  }

  var keywordsPerRow = 6;

  var start = -1;

  window.getStart=function(){return start};

  const MAX_PERMUTATIONS = 8*7*6*5*4*3*2;

  function updateDynamicProgress()
  {
    var timestamp;
    var max = keywordCount;
    var sum = keywordsDone;

    timestamp = (Date.now()-start)/1000;

    $("#ppsCurrent").html(Math.ceil((sum*MAX_PERMUTATIONS)/timestamp));

    $(".timeCurrent").html(timestamp.toFixed(3)+"s");
    $(".keywordsDone").html(sum);
    $(".keywordsTotal").html(max);

    if(sum==max) {
      $(".keyword").attr("state","done");
    }

    updateProgress(sum,max);
  }

  function setStatus(txt)
  {
    $("#statusText").html(txt);
  }

  function padKeyword(txt)
  {
    while(txt.length<16)
    {
      txt = " " + txt + " ";
    }
    return txt.substr(0,16).replace(/ /g,"&nbsp;");
  }

  keywordsPerRow=Math.floor(400/$("<span class=\"keyword\" state=\"notstarted\">ABCDEFGHIJKLMNOP</span>").width());

  function updateKeyword(keyword,state)
  {
    if(keywordCount > 2000) {
      return;
    }
    var list = document.getElementsByClassName("keyword");
    var i,el;
    for(i=0;i<list.length;i++)
    {
      el=list[i];
      if(el.getAttribute("data-keyword")==keyword)
      {
        el.setAttribute("state",state);
        break;
      }
    }
    //$(`.keyword[data-keyword="${keyword}"]`).attr('state',state);
  }

  var keywordCount = 0,keywordsDone = 0;
  var working = false;
  var anagrams = [];

  var lastBenchCount = 0;

  function onMessage(ev){
    var msg = ev.data;
    var out = "";

    if(msg.cmd == "ANAGRAM")
    {
      anagrams[msg.params[0]]=msg.params[1];
    } else

    if(msg.cmd == "READY")
    {
      console.log("The head worker is ready.");
      codeWorker.postMessage({cmd:"BENCHMARK",params:[]});
      setStatus("Performing benchmark...");
    } else

    if(msg.cmd == "KEYWORDS")
    {
      console.log("Got em keywords you were asking for, boss.");
      var i,kwords = msg.params[0];
      keywordCount = kwords.length;
      keywordsDone = 0;
      console.log("Found %d keywords.",keywordCount);
      console.log("\t"+kwords.join("\n\t"));
      for(i=0;i<kwords.length;i++)
      {
        out+=`<span class="keyword" data-keyword="${kwords[i]}" state="${keywordCount<2000?"notstarted":"inprogress"}">${padKeyword(kwords[i].toUpperCase())}</span>`+
             `${((i%keywordsPerRow!==keywordsPerRow-1)?" ":"")}`;
        if(i%keywordsPerRow===keywordsPerRow-1) {
          out+="<br />";
        }
      }
      $('#listKeywords').html(out);
      updateDynamicProgress();
      setStatus("Processing keywords...");
    } else

    if(msg.cmd == "START_KEYWORD")
    {
      updateKeyword(msg.params[0],"inprogress");
      setStatus(`Keyword '${msg.params[0]}' started.`);
    } else

    if(msg.cmd == "DONE_KEYWORD")
    {
      keywordsDone++;
      updateKeyword(msg.params[0],"done");
      updateDynamicProgress();
      setStatus(`Keyword '${msg.params[0]}' finished.`);
    } else 

    if(msg.cmd == "BENCHMARK_PROG")
    {
      if(msg.params[0]-lastBenchCount>40) {
        lastBenchCount = msg.params[0];
        updateProgress(msg.params[0],msg.params[1]);
      }
    } else

    if(msg.cmd == "BENCHMARK_RESULT")
    {
      updateProgress(MAX_PERMUTATIONS,MAX_PERMUTATIONS);
      var workerCount = Math.min(15,(msg.params[0]<20000?Math.ceil(10000/msg.params[0]):0)+1);
      console.log("It took %d ms to permute one word.",msg.params[0]);
      console.log("This means that only %d workers can be spawned.",workerCount);

      codeWorker.postMessage({cmd:"OPT",params:["max_workers",workerCount]});
      setStatus(`Benchmark finished! Max number of workers: ${workerCount}`);
      $(".workers").show();
      $(".workersMax").html(workerCount);
      setTimeout(()=>{
        setStatus("Ready!");
        updateProgress(0,0);
      },1000);
      ready = true;
    } else

    if(msg.cmd == "CODE")
    {
      var code = msg.params[1];
      var keyword = msg.params[0];
      console.log("New code '%s' was discovered from keyword '%s'!",code.num,keyword);
      $("#listLaunchCodes").append(`<span>'${code.word}'[${keyword}] produced the code '${processCode(code.num)}'</span><br />`);
      setStatus(`Code! ${code.word}[${keyword}]: '${code.text}' (${processCode(code.num)}).`);
    } else

    if(msg.cmd == "DONE")
    {
      working=false;
      setStatus("Finished!");
      updateProgress(0,0);
      $(".cipherKeyword").prop("disabled",false);
      $(".launchCode").prop("disabled",false);
    } else 

    if(msg.cmd == "INVALID")
    {
      console.log("An invalid command was sent to the keyword worker!");
      console.error(msg.params[0]);
    }
    //console.log("New message from worker!");
    //console.log(ev);
  }

  window.codeWorker = new Worker("keyword-worker.js");

  codeWorker.addEventListener("message",onMessage);

  codeWorker.addEventListener('error',(ev)=>{
    console.log(ev);
  });

  $(document).ready(function(){
    if(!browserMeta.isChromiumBased) 
    {
      $("#warningText").html("<span style='color:#C00'>Warning:</span><br />"+
                             "This application works best in a chromium based browser.<br />"+
                             "This is due to how they handle WebWorkers.<br />"+
                             "Expect mild freezing of the application during extensive<br />"+
                             "work (e.g. more than double your workers in keywords)");
    }
    Inputmask.extendAliases({
      'launchCode': {
        autoUnmask:false,
        mask:"a-9",
        oncomplete:function(e)
        {
          var tid = parseInt(e.target.name.substr(5));
          e.target.value = e.target.value.toUpperCase();
          if(isValidNukeCode($(e.target),tid)) {
            if(e.target.classList.contains("bad")) {
              e.target.classList.remove("bad");
            }
            e.target.classList.add("good");
            if(tid!=7) {
              $("input[name=kCode"+(tid+1)+"]").focus();
            }
          } else {
            if(e.target.classList.contains("good")) {
              e.target.classList.remove("good");
            }
            e.target.classList.add("bad");
          }
          updateShareLink();
        }
      },
      'cipher': {
        autoUnmask:false,
        regex: KEYWORD_REGEX.toString().replace("/i","/").replace(/[\/\^\$]/g,""),
        oncomplete:function(e)
        {
          if(isValidKeywordFilter(e.target.value)) {
            if(e.target.classList.contains("bad")) {
              e.target.classList.remove("bad");
            }
            e.target.classList.add("good");
          } else {
            if(e.target.classList.contains("good")) {
              e.target.classList.remove("good");
            }
            e.target.classList.add("bad");
          }
          updateShareLink();
        }
      }
    });
    Inputmask().mask(document.querySelectorAll("input"));

    $('form,input').change(()=>{
      updateShareLink();
    });

    $('form').submit(function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if(!ready)
      {
        alert("Please wait for the program to finish benchmarking.");
        return false;
      }
      if(working)
      {
        alert("Please wait for the current code breaking to finish, or refresh the page.");
        return false;
      }
      var keyword = $(".cipherKeyword").val().replace(/_/g,"?");
      if(isValidKeywordFilter(keyword) && areCodesGood())
      {
        setTimeout(()=>{
          var topOfContent = $("a[name='workProgress']").offset().top;
          if($(document).height()-topOfContent>=$(window).height()) {
            $('html,body').animate({scrollTop: topOfContent},1500);
          } else {
            console.log("Not enough content to scroll :'( (%d<%d)",$(document).height()-topOfContent,$(window).height());
          }
        },500);
        updateShareLink();
        start = Date.now();
        $(".info > p").show();
        keywordCount=0;
        $("#listLaunchCodes").html("");
        $("#listKeywords").html("");
        $(".cipherKeyword").prop("disabled",true);
        $(".progbar").attr("state","inprogress");
        $(".launchCode").prop("disabled",true);
        var eAnagram = getEncodedAnagram();
        $("#encodedAnagram").html(eAnagram.toUpperCase());
        codeWorker.postMessage({id:"test",cmd:"DECODE",params:[keyword.toLowerCase(),eAnagram.toLowerCase()]});
        working = true;
      } else {
        alert("Please check your code pieces to make sure none of them have the same number and check to ensure you have a valid keyword.");
      }
      return false;
    });

    $('#infoDialog').dialog({
      dialogClass: "no-close",
      buttons: [
        {
          text: "OK",
          click: function() {
            $( this ).dialog( "close" );
          }
        }
      ],
      title:"How this application finds the nuclear codes.",
      width:600,
      maxHeight:400,
      modal:true,
      position:{
        my:"center",
        at:"center",
        of:window
      }
    });

    $("#infoDialog").dialog("close");

    window.showDialog = function(ev)
    {
      ev.preventDefault();
      ev.stopPropagation();
      $("#infoDialog").dialog("open");
      return false;
    }
  });

  function generateShareLink()
  {
    var cipher = $(".cipherKeyword").val().replace(/_/g,"?");
    var numbers = processCode("01234567");
    var code = getEncodedAnagram();
    var shortVersion = "";
    var i;
    var bytes = new Uint8Array(10+4+5);
    while(cipher.length<16)
    {
      cipher+=String.fromCharCode(0);
    }
    // Cipher
    bytes[0] =  ((cipher.charCodeAt(0) & 0x1F) << 3) |
                ((cipher.charCodeAt(1) & 0x1C) >> 2);
    bytes[1] =  ((cipher.charCodeAt(1) & 0x03) << 6) |
                ((cipher.charCodeAt(2) & 0x1F) << 1) |
                ((cipher.charCodeAt(3) & 0x10) >> 4);
    bytes[2] =  ((cipher.charCodeAt(3) & 0x0F) << 4) |
                ((cipher.charCodeAt(4) & 0x1E) >> 1);
    bytes[3] =  ((cipher.charCodeAt(4) & 0x01) << 7) |
                ((cipher.charCodeAt(5) & 0x1F) << 2) |
                ((cipher.charCodeAt(6) & 0x18) >> 3);
    bytes[4] =  ((cipher.charCodeAt(6) & 0x07) << 5) |
                ((cipher.charCodeAt(7) & 0x1F) << 0);
    bytes[5] =  ((cipher.charCodeAt(8) & 0x1F) << 3) |
                ((cipher.charCodeAt(9) & 0x1C) >> 2);
    bytes[6] =  ((cipher.charCodeAt(9) & 0x03) << 6) |
                ((cipher.charCodeAt(10) & 0x1F) << 1) |
                ((cipher.charCodeAt(11) & 0x10) >> 4);
    bytes[7] =  ((cipher.charCodeAt(11) & 0x0F) << 4) |
                ((cipher.charCodeAt(12) & 0x1E) >> 1);
    bytes[8] =  ((cipher.charCodeAt(12) & 0x01) << 7) |
                ((cipher.charCodeAt(13) & 0x1F) << 2) |
                ((cipher.charCodeAt(14) & 0x18) >> 3);
    bytes[9] =  ((cipher.charCodeAt(14) & 0x07) << 5) |
                ((cipher.charCodeAt(15) & 0x1F) << 0);
    // Numbers
    bytes[10] = ((numbers.charCodeAt(0) & 0x0F) << 4) |
                ((numbers.charCodeAt(1) & 0x0F) << 0);
    bytes[11] = ((numbers.charCodeAt(2) & 0x0F) << 4) |
                ((numbers.charCodeAt(3) & 0x0F) << 0);
    bytes[12] = ((numbers.charCodeAt(4) & 0x0F) << 4) |
                ((numbers.charCodeAt(5) & 0x0F) << 0);
    bytes[13] = ((numbers.charCodeAt(6) & 0x0F) << 4) |
                ((numbers.charCodeAt(7) & 0x0F) << 0);
    // Code
    bytes[14] = ((code.charCodeAt(0) & 0x1F) << 3) |
                ((code.charCodeAt(1) & 0x1C) >> 2);
    bytes[15] = ((code.charCodeAt(1) & 0x03) << 6) |
                ((code.charCodeAt(2) & 0x1F) << 1) |
                ((code.charCodeAt(3) & 0x10) >> 4);
    bytes[16] = ((code.charCodeAt(3) & 0x0F) << 4) |
                ((code.charCodeAt(4) & 0x1E) >> 1);
    bytes[17] = ((code.charCodeAt(4) & 0x01) << 7) |
                ((code.charCodeAt(5) & 0x1F) << 2) |
                ((code.charCodeAt(6) & 0x18) >> 3);
    bytes[18] = ((code.charCodeAt(6) & 0x07) << 5) |
                ((code.charCodeAt(7) & 0x1F) << 0);

    for(i=0;i<bytes.length;i++)
    {
      shortVersion+=String.fromCharCode(bytes[i]);
    }

    var protocol = window.location.protocol;
    var base = window.location.host + window.location.pathname;
    return `${protocol}//${base}?q=${Base64.encodeURI(shortVersion)}`;
  }

  window.generateShareLink=generateShareLink;

  function updateShareLink()
  {
    var shareLink = generateShareLink();
    $(".shareLink").html(shareLink);
    $(".shareLink").attr("href",shareLink);
  }

  window.updateShareLink=updateShareLink;

  function parseShareLinkCode(sharecode)
  {
    var qStr = Base64.decode(sharecode);
    var i,bytes = [];
    var cipher = "",numbers = "",code = "",ch;
    for(i=0;i<qStr.length;i++)
    {
      bytes[i]=qStr.charCodeAt(i);
    }
    // Cipher
    //0
    ch = String.fromCharCode(0x40 | ((bytes[0]&0xF8) >> 3));
    cipher += ch=="_"?"?":ch;
    //1
    ch = String.fromCharCode(0x40 | (((bytes[0]&0x07) << 2)|((bytes[1]&0xC0) >> 6)));
    cipher += ch=="_"?"?":ch;
    //2
    ch = String.fromCharCode(0x40 | (((bytes[1]&0x3E) >> 1)));
    cipher += ch=="_"?"?":ch;
    //3
    ch = String.fromCharCode(0x40 | (((bytes[1]&0x01) << 4)|((bytes[2]&0xF0) >> 4)));
    cipher += ch=="_"?"?":ch;
    //4
    ch = String.fromCharCode(0x40 | (((bytes[2]&0x0F) << 1)|((bytes[3]&0x80) >> 7)));
    cipher += ch=="_"?"?":ch;
    //5
    ch = String.fromCharCode(0x40 | (((bytes[3]&0x7C) >> 2)));
    cipher += ch=="_"?"?":ch;
    //6
    ch = String.fromCharCode(0x40 | (((bytes[3]&0x03) << 3)|((bytes[4]&0xE0) >> 5)));
    cipher += ch=="_"?"?":ch;
    //7
    ch = String.fromCharCode(0x40 | (bytes[4]&0x1F));
    cipher += ch=="_"?"?":ch;
    //8
    ch = String.fromCharCode(0x40 | (((bytes[5]&0xF8) >> 3)));
    cipher += ch=="_"?"?":ch;
    //9
    ch = String.fromCharCode(0x40 | (((bytes[5]&0x07) << 2)|((bytes[6]&0xC0) >> 6)));
    cipher += ch=="_"?"?":ch;
    //10
    ch = String.fromCharCode(0x40 | (((bytes[6]&0x3E) >> 1)));
    cipher += ch=="_"?"?":ch;
    //11
    ch = String.fromCharCode(0x40 | (((bytes[6]&0x01) << 4)|((bytes[7]&0xF0) >> 4)));
    cipher += ch=="_"?"?":ch;
    //12
    ch = String.fromCharCode(0x40 | (((bytes[7]&0x0F) << 1)|((bytes[8]&0x80) >> 7)));
    cipher += ch=="_"?"?":ch;
    //13
    ch = String.fromCharCode(0x40 | (((bytes[8]&0x7C) >> 2)));
    cipher += ch=="_"?"?":ch;
    //14
    ch = String.fromCharCode(0x40 | (((bytes[8]&0x03) << 3)|((bytes[9]&0xE0) >> 5)));
    cipher += ch=="_"?"?":ch;
    //15
    ch = String.fromCharCode(0x40 | (bytes[9]&0x1F));
    cipher += ch=="_"?"?":ch;

    // Numbers
    numbers += String.fromCharCode(0x30 | ((bytes[10]&0xF0) >> 4));
    numbers += String.fromCharCode(0x30 | (bytes[10]&0x0F));
    numbers += String.fromCharCode(0x30 | ((bytes[11]&0xF0) >> 4));
    numbers += String.fromCharCode(0x30 | (bytes[11]&0x0F));
    numbers += String.fromCharCode(0x30 | ((bytes[12]&0xF0) >> 4));
    numbers += String.fromCharCode(0x30 | (bytes[12]&0x0F));
    numbers += String.fromCharCode(0x30 | ((bytes[13]&0xF0) >> 4));
    numbers += String.fromCharCode(0x30 | (bytes[13]&0x0F));

    // Code
    //0
    ch = String.fromCharCode(0x40 | ((bytes[14]&0xF8) >> 3));
    code += ch=="_"?"?":ch;
    //1
    ch = String.fromCharCode(0x40 | (((bytes[14]&0x07) << 2)|((bytes[15]&0xC0) >> 6)));
    code += ch=="_"?"?":ch;
    //1
    ch = String.fromCharCode(0x40 | (((bytes[15]&0x3E) >> 1)));
    code += ch=="_"?"?":ch;
    //3
    ch = String.fromCharCode(0x40 | (((bytes[15]&0x01) << 4)|((bytes[16]&0xF0) >> 4)));
    code += ch=="_"?"?":ch;
    //4
    ch = String.fromCharCode(0x40 | (((bytes[16]&0x0F) << 1)|((bytes[17]&0x80) >> 7)));
    code += ch=="_"?"?":ch;
    //5
    ch = String.fromCharCode(0x40 | (((bytes[17]&0x7C) >> 2)));
    code += ch=="_"?"?":ch;
    //6
    ch = String.fromCharCode(0x40 | (((bytes[17]&0x03) << 3)|((bytes[18]&0xE0) >> 5)));
    code += ch=="_"?"?":ch;
    //7
    ch = String.fromCharCode(0x40 | (bytes[18]&0x1F));
    code += ch=="_"?"?":ch;

    cipher = cipher.replace(/@/g,"");

    return {cipher:cipher,numbers:numbers,code:code};
  }

  function fillForm(cipher,code,numbers,donotsubmit)
  {
    el=$(".cipherKeyword").first();
    el.val(cipher.toUpperCase());
    if(isValidKeywordFilter(el.val())){
      if(el.hasClass("bad")) {
        el.removeClass("bad");
      }
      el.addClass("good");
      if(i!=7) {
        $("input[name=kCode0]").focus();
      }
    } else {
      if(el.hasClass("good")) {
        el.removeClass("good");
      }
      el.addClass("bad");
    }
    for(var i=0,el;i<8;i++) {
      el=$("input[name=kCode"+i+"]").first();
      el.val(code[i].toUpperCase()+"-"+(numbers[i]?numbers[i]:i));
      if(isValidNukeCode(el,i)){
        if(el.hasClass("bad")) {
          el.removeClass("bad");
        }
        el.addClass("good");
        if(i!=7) {
          $(`input[name=kCode${i+1}]`).focus();
        }
      } else {
        if(el.hasClass("good")) {
          el.removeClass("good");
        }
        el.addClass("bad");
      }
    }
    updateShareLink();
    if(!donotsubmit) {
      $("form").submit();
    }
  }

  window.fillForm = fillForm;

  (function($) {
    $.QueryString = (function(paramsArray) {
      let params = {};

      for (let i = 0; i < paramsArray.length; ++i)
      {
        let param = paramsArray[i].split('=', 2);

        if (param.length !== 2)
          continue;

        params[param[0]] = decodeURIComponent(param[1].replace(/\+/g, " "));
      }

      return params;
    })(window.location.search.substr(1).split('&'))
  })(jQuery);

  if($.QueryString["cipher"]!==undefined && $.QueryString["code"]!==undefined)
  {
    var numbers = ($.QueryString["numbers"]!==undefined)
      ?
      $.QueryString["numbers"]
      :
      "01234567";
    fillForm($.QueryString["cipher"],$.QueryString["code"],
      numbers,true);
    var kPieceStr = "";

    for(var i=0;i<8;i++) {
      kPieceStr+=$.QueryString["code"][i]+"-"+numbers[i]+(i<7?", ":"");
    }
    $('meta[name="description"]').attr("content",
      "Cipher: "+$.QueryString["cipher"]+"\n"+
      "Key Pieces: "+kPieceStr+"\n"+
      "Figures out what your nuclear launch code is from 8 silo code pieces and a portion of the keyword from the Enclave bunker.");
    $('meta[name="og:description"]').attr("content",
      "Cipher: "+$.QueryString["cipher"]+"\n"+
      "Key Pieces: "+kPieceStr+"\n"+
      "Figures out what your nuclear launch code is from 8 silo code pieces and a portion of the keyword from the Enclave bunker.");
  } else if($.QueryString["q"]) {
    var dat = parseShareLinkCode($.QueryString["q"]);
    console.log(dat.cipher,dat.numbers,dat.code);
    var kPieceStr = "";

    for(var i=0;i<8;i++) {
      kPieceStr+=dat.code[i]+"-"+dat.numbers[i]+(i<7?", ":"");
    }
    $('meta[name="description"]').attr("content",
      "Cipher: "+dat.cipher+"\n"+
      "Key Pieces: "+kPieceStr+"\n"+
      "Figures out what your nuclear launch code is from 8 silo code pieces and a portion of the keyword from the Enclave bunker.");
    $('meta[name="og:description"]').attr("content",
      "Cipher: "+dat.cipher+"\n"+
      "Key Pieces: "+kPieceStr+"\n"+
      "Figures out what your nuclear launch code is from 8 silo code pieces and a portion of the keyword from the Enclave bunker.");
    fillForm(dat.cipher,dat.code,dat.numbers,true);
  }

  $.getJSON("./keywords.json",data=>{
    $(".keywordCount").html(data.length);
  });

  // Based on code from https://stackoverflow.com/a/6117889
  // Returns ISO-8601 week number
  function getWeekNumber(d)
  {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yS = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return [d.getUTCFullYear(),Math.ceil((((d-yS)/86400000)+1)/7)];
  }

  // Relative to Fallout 76's launch date
  function getRelativeWeek()
  {
    var wN = getWeekNumber(new Date());
    return wN[1]+(wN[0]-2018)*53-(wN[0]==2018?46:47);
  }

  const DELAY_BETWEEN_CODE_UPDATES = 5*60*1000;

  const SPREADHSEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzW9RTZnMxx_6ejDMDenM6dkiLgVJQvFCJVaPYy_AVQvuiQpdZXqLUthjbJprGBHydULN9DiwxGtJu/pub?gid=32177490&single=true&output=csv";

  var updateCodesTimeout = -1;
  var lastUpdateToCodes = -1;

  function updateCodes()
  {
    if(lastUpdateToCodes>-1) {
      if(Date.now()-lastUpdateToCodes<Math.min(DELAY_BETWEEN_CODE_UPDATES/5,60000)) {
        updateCodesTimeout = setTimeout(updateCodes,DELAY_BETWEEN_CODE_UPDATES);
        return;
      }
    }
    lastUpdateToCodes = Date.now();
    $.get(SPREADHSEET_URL,(data)=>{
      var dat = {},i,rows = data.split("\n"),row;
      for(i=1;i<rows.length;i++)
      {
        row = rows[i].split(",");
        dat[row[2]] = {
          start:row[0],
          end:row[1],
          alpha:row[3].replace(/[^0-9]/g,""),
          bravo:row[4].replace(/[^0-9]/g,""),
          charlie:row[5].replace(/[^0-9]/g,"")
        };
      }

      window.codeData = dat;

      var weekNo = getRelativeWeek();

      var weekStart = new Date(1542067200000+(7*24*60*60*1000)*2).toLocaleDateString();
      var weekEnd = new Date(1542067200000+(7*24*60*60*1000)*2+(6*24*60*60*1000)).toLocaleDateString();

      $("#knownCodeStart").html(weekStart);
      $("#knownCodeEnd").html(weekEnd);

      var weekData = dat[weekNo];

      if(!weekData) {
        $("#knownCodeAlpha").html("Not Solved Yet");
        $("#knownCodeBravo").html("Not Solved Yet");
        $("#knownCodeCharlie").html("Not Solved Yet");
      } else {
        $("#knownCodeAlpha").html(weekData.alpha?weekData.alpha:"Not Solved Yet");
        $("#knownCodeBravo").html(weekData.bravo?weekData.bravo:"Not Solved Yet");
        $("#knownCodeCharlie").html(weekData.charlie?weekData.charlie:"Not Solved Yet");
      }

      updateCodesTimeout = setTimeout(updateCodes,DELAY_BETWEEN_CODE_UPDATES);
    });
  }

  $("#knownCodesTitle").click(()=>{
    if(updateCodesTimeout>-1) {
      clearTimeout(updateCodesTimeout);
      updateCodesTimeout=-1;
    }
    updateCodes();
    $("#knownCodes").toggle(500);
  });

  updateCodes();
});