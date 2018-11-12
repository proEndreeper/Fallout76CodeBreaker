'use strict';
$(function(){
  var browserMeta = {
    isChromiumBased: /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent)
  };

  var ready = false;
  if(typeof(Worker) === "undefined") {
    alert("Sorry but this program requires the Worker class, and your browser doesn't seem to support this class.")

    return;
  }

  const NUKECODE_REGEX = /^([a-z])\-([0-9])$/i;
  const KEYWORD_REGEX = /^[a-z\?][a-z\?][a-z\?][a-z\?][a-z\?][a-z\?][a-z\?][a-z\?][a-z\?][a-z\?][a-z\?]$/i

  function alluniq(str)
  {
    var used = {},i;
    for(i=0;i<str.length;i++)
    {
      if(str[i]=="?") {
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
    var used = parseInt($("input[name=kCode"+code_id+"]").val().substr(2),10),code;
    for(var i=0;i<8;i++)
    {
      if(i==code_id) continue;
      code = parseInt($("input[name=kCode"+i+"]").val().substr(2),10);
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
    var used = new Uint8Array(8);
    for(var i=0;i<8;i++)
    {
      code = parseInt($("input[name=kCode"+i+"]").val().substr(2),10);
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
    return NUKECODE_REGEX.test(field.val()) && !isCodeDuplicate(tid) && parseInt(field.val().substr(2))<8;
  }

  var keywordProg = {};

  $(document).ready(function(){
    if(!browserMeta.isChromiumBased) 
    {
      $("#warningText").html("<span style='color:#C00'>Warning:</span><br />"+
                             "This application works best in a chromium based browser.<br />"+
                             "This is due to how they handle WebWorkers.<br />"+
                             "Expect mild freezing of the window");
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
        }
      },
      'cipher': {
        autoUnmask:true,
        regex: "[A-Za-z\?][A-Za-z\?][A-Za-z\?][A-Za-z\?][A-Za-z\?][A-Za-z\?][A-Za-z\?][A-Za-z\?][A-Za-z\?][A-Za-z\?][A-Za-z\?]",
        oncomplete:function(e)
        {
          e.target.value = e.target.value.toUpperCase();
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
        }
      }
    });
    Inputmask().mask(document.querySelectorAll("input"));
  });

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

  var start = -1;

  window.getStart=function(){return start};

  const MAX_PERMUTATIONS = 8*7*6*5*4*3*2;

  function updateDynamicProgress()
  {
    var max = keywordCount;

    var sum = keywordsDone;

    if(sum===0) {
      start = Date.now();
    }

    $("#ppsCurrent").html(Math.ceil((sum*MAX_PERMUTATIONS)/((Date.now()-start)/1000)));

    updateProgress(sum,max);
  }

  function setStatus(txt)
  {
    $("#statusText").html(txt);
  }

  function updateKeyword(keyword,state)
  {
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
      for(i=0;i<kwords.length;i++)
      {
        out+=`<span class="keyword" data-keyword="${kwords[i]}" state="notstarted">${kwords[i].toUpperCase()}</span>${((i%6!==5)?" ":"")}`;
        if(i%6===5) {
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
      keywordProg[msg.params[0]] = MAX_PERMUTATIONS;
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
      $("#workersMax").html(workerCount);
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
      $("#listLaunchCodes").append(`<span>'${code.word}'[${keyword}] produced the code '${code.num}'</span><br />`);
      setStatus(`Code! ${code.word}[${keyword}]: '${code.text}' (${code.num}).`);
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

  $('form').submit(function(){
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
    var keyword = $(".cipherKeyword").val();
    if(isValidKeywordFilter(keyword) && areCodesGood())
    {
      keywordCount=0;
      keywordProg={};
      $("#listLaunchCodes").html("");
      $("#listKeywords").html("");
      $(".cipherKeyword").prop("disabled",true);
      $(".progbar").attr("state","inprogress");
      $(".launchCode").prop("disabled",true);
      var eAnagram = [];
      for(var i=0,code;i<8;i++)
      {
        code = parseInt($("input[name=kCode"+i+"]").val().substr(2),10);
        eAnagram[code] = $("input[name=kCode"+i+"]").val().substr(0,1);
      }
      $("#encodedAnagram").html(eAnagram.join("").toUpperCase());
      codeWorker.postMessage({id:"test",cmd:"DECODE",params:[keyword.toLowerCase(),eAnagram.join("").toLowerCase()]});
      working = true;
    } else {
      alert("Please check your code pieces to make sure none of them have the same number and check to ensure you have a valid keyword.");
    }
    return false;
  });

  function fillForm(cipher,code,donotsubmit)
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
    $(".cipherKeyword").val();
    for(var i=0,el;i<8;i++) {
      el=$("input[name=kCode"+i+"]").first();
      el.val(code[i].toUpperCase()+"-"+i);
      if(isValidNukeCode(el,i)){
        if(el.hasClass("bad")) {
          el.removeClass("bad");
        }
        el.addClass("good");
        if(i!=7) {
          $("input[name=kCode"+(i+1)+"]").focus();
        }
      } else {
        if(el.hasClass("good")) {
          el.removeClass("good");
        }
        el.addClass("bad");
      }
    }
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
    fillForm($.QueryString["cipher"],$.QueryString["code"],true);
  }
});