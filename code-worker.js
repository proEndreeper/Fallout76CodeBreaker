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

loadJSON("./potential-codes.json",data=>{
  codes=Array.from(JSON.parse(data));
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

function binarySearch(arr, target) {
    let left = 0;
    let right = arr.length - 1;
    while (left <= right) {
        const mid = left + Math.floor((right - left) / 2);
        if (arr[mid] === target) {
            return mid;
        }
        if (arr[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return -1;
}

var unscrambleWord;
function setupUnscrambler()
{
  if(browserMeta.isChromiumBased)
  {
    unscrambleWord = function(word,callback)
    {
      function permute(permutation)
      {
        var length = permutation.length,
            c = new Array(length).fill(0),
            i = 1, k, p;

        while(i<length) {
          if (c[i] < i) {
            k = i % 2 && c[i];
            p = permutation[i];
            permutation = permutation.substr(0,i)+permutation[k]+permutation.substr(i+1);
            permutation = permutation.substr(0,k)+p+permutation.substr(k+1);[k];
            ++c[i];
            i = 1;
            if(binarySearch(codes,permutation)>-1)
            {
              callback({num:genCode(permutation,word),word:permutation});
            }
          } else {
            c[i] = 0;
            ++i;
          }
        }
        callback(null);
      }
      if(binarySearch(codes,word)>-1)
      {
        callback({num:genCode(word,word),word:word});
      }
      permute(word);
    };
  } else {
    unscrambleWord=function(word,callback)
    {
      function permute(permutation) {
        var length = permutation.length,
            c = new Array(length).fill(0),
            i = 1, k, p;

        function doPermutation(i,permutation)
        {
          if(i>=length) {
            callback(null);
            return;
          }
          if (c[i] < i) {
            k = i % 2 && c[i];
            p = permutation[i];
            permutation = permutation.substr(0,i)+permutation[k]+permutation.substr(i+1);
            permutation = permutation.substr(0,k)+p+permutation.substr(k+1);
            ++c[i];
            i = 1;
            if(binarySearch(codes,permutation)>-1)
            {
              callback({num:genCode(permutation,word),word:permutation});
            }
          } else {
            c[i] = 0;
            ++i;
          }
          setTimeout(doPermutation.bind(this,i,permutation),DELAY);
        }

        doPermutation(i,permutation);
      }
      if(binarySearch(codes,word)>-1)
      {
        callback({num:genCode(word,word),word:word});
      }
      permute(word);
    };
  }
}


const MAX_PERMUTATIONS = 8*7*6*5*4*3*2;
function startProcessing()
{
  processing = true;
  var count = 0;
  var maxCount = MAX_PERMUTATIONS;
  var lastCount = 0;
  function callback(code)
  {
    if(code===null) {
      done = true;
      //console.log("Worker '%s' is done.",ID);
      postMessage({id:ID,cmd:"DONE",params:[]});
      return;
    }
    postMessage({id:ID,cmd:"CODE",params:[ID,code]});
  }

  unscrambleWord(ANAGRAM,callback);
}

function closeMePlease()
{
  if(done)
  {
    postMessage({id:ID,cmd:"DONE",params:[]});
  }
}
var tryingToProcessIntvl = -1;

function tryToProcess()
{
  if(ready && !processing && ID!="") {
    clearInterval(tryingToProcessIntvl);
    startProcessing();
  }
}

tryingToProcessIntvl = setInterval(tryToProcess,10);
setInterval(closeMePlease,500);

addEventListener("message",(ev)=>{
  if(ANAGRAM!=="") {
    return;
  }
  var msg = ev.data;

  ID = msg.id;
  if(msg.cmd=="INIT") {
    ANAGRAM = msg.params[0];
    EANAGRAM = msg.params[1];
    //DELAY = !isFinite(msg.params[2])?0:msg.params[2];
    setupUnscrambler();
    //console.log(`Worker for keyword '${ID}' initialized to ${ANAGRAM} with a delay of ${DELAY}ms!`)
    return;
  }
});