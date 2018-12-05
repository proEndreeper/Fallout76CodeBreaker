'use strict';
var ANAGRAM = "",
   EANAGRAM = "",
   DELAY = 1;
var ID = "";
var codes = [],
      ready = false,
      done = false,
      processing = false;

var browserMeta = {
  isChromiumBased: /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent)
};

 function loadJSON(file,callback) {   

    var xobj = new XMLHttpRequest();
    xobj.open('GET', file, true); // Replace 'my_data' with the path to your file
    xobj.onerror = function(){
      console.log(arguments);
    }
    xobj.onreadystatechange = function () {
          if (xobj.readyState == 4 && xobj.status == "200") {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
            if(xobj.responseText.length<10) console.log(xobj.status,xobj.responseText);
          } else {
          }
    };
    xobj.send(null);  
 }

loadJSON("./sorted-codes.json",data=>{
  codes=JSON.parse(data);
  ready = true;
});

function genCode(solution,anagram)
{
  var code = "";
  for(var i=0;i<solution.length;i++)
  {
    code+=anagram.indexOf(solution[i]);
  }
  return code;
}

function unscrambleWord(word,callback) 
{
  var sword = word.toLowerCase().split("").sort().join("");
  if(codes[sword]!==undefined) {
    for(var i=0;i<codes[sword].length;i++)
    {
      callback({num:genCode(codes[sword][i],word),word:codes[sword][i]});
    }
  }
  callback(null);
}

function startProcessing()
{
  processing = true;
  function callback(code)
  {
    if(code===null) {
      //console.log("Worker '%s' is done.",ID);
      postMessage({id:ID,cmd:"DONE",params:[]});
      processing = false;
      ANAGRAM = "";
      EANAGRAM = "";
      ID ="";
      return;
    }
    postMessage({id:ID,cmd:"CODE",params:[ID,code]});
  }

  unscrambleWord(ANAGRAM,callback);
}

var tryingToProcessIntvl = -1;

function tryToProcess()
{
  if(ready && !processing && ID!="") {
    startProcessing();
  }
}

tryingToProcessIntvl = setInterval(tryToProcess,10);

addEventListener("message",(ev)=>{

  if(ANAGRAM!=="") {
    return;
  }
  var msg = ev.data;

  ID = msg.id;
  if(msg.cmd=="INIT") {
    ANAGRAM = msg.params[0];
    EANAGRAM = msg.params[1];
    return;
  }
});