'use strict';
var keywords = [],
    codes = [],
    ready = false;

 function loadJSON(file,callback) {   

    var xobj = new XMLHttpRequest();
    xobj.open('GET', file, true); // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function () {
          if (xobj.readyState == 4 && xobj.status == "200") {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
          }
    };
    xobj.send(null);  
 }

loadJSON("./keywords.json",data=>{
  keywords = Array.from(JSON.parse(data));
  loadJSON("./potential-codes.json",data=>{
    codes=Array.from(JSON.parse(data));
    ready = true;
    postMessage({cmd:"READY",params:[]});
  });
});

function generateCipher(keyword)
{
  var used = new Uint8Array(26);
  var cipher = [];
  var i=0,j;

  for(i=0;i<keyword.length;i++)
  {
    if(used[(keyword.charCodeAt(i) & 0x1F)-1] === 0) {
      cipher[i] = keyword[i];
      used[(keyword.charCodeAt(i) & 0x1F)-1] = 1;
    }
  }
  for(i=0;i<26;i++)
  {
    if(cipher[i]!==undefined)
      continue;
    for(j=0;j<26;j++)
    {
      if(used[j] === 0)
      {
        used[j] = 1;
        cipher[i] = String.fromCharCode(0x60 | (j+1));
        break;
      }
    }
  }
  return cipher;
}

function convertWord(word,cipher)
{
  var i;
  var nWord = "";
  for(i=0;i<word.length;i++)
  {
    nWord+= String.fromCharCode(0x60 | (cipher.indexOf(word[i])+1));
  }
  return nWord;
}

function findKeywords(filter)
{

  var filterRegex = new RegExp(filter.replace(/\?+/g,(match)=>{return "[^"+filter.replace(/\?/g,"")+"]{"+match.length+",16}"}));

  var kwords = keywords.filter(RegExp.prototype.test.bind(filterRegex));

  return kwords;
}

var options = {max_workers:0,delay:0} ;

var NUM_AVAILABLE = options.max_workers;

var workers = [];

var queue = [];

function getNextIndex()
{
  if(NUM_AVAILABLE < 1) {
    return -1;
  }
  for(var i=0;i<options.max_workers;i++)
  {
    if(!(workers[i] instanceof Worker)) {
      return i;
    }
  }
  return -1;
}

const MAX_PERMUTATIONS = 8*7*6*5*4*3*2;

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

function benchmark()
{
  function unscrambleWord(word,callback)
  {
    function permute(permutation) {
      var length = permutation.length,
          result = [permutation.slice()],
          c = new Array(length).fill(0),
          i = 1, k, p;

      while (i < length) {
        if (c[i] < i) {
          k = i % 2 && c[i];
          p = permutation[i];
          permutation = permutation.substr(0,i)+permutation[k]+permutation.substr(i+1);
          permutation = permutation.substr(0,k)+p+permutation.substr(k+1);[k];
          ++c[i];
          i = 1;
          if(binarySearch(permutation)>-1)
          {}
          callback();
        } else {
          c[i] = 0;
          ++i;
        }
      }
      callback(null);
    }

    permute(word);
  }
  var now = typeof(performance)!="undefined"?performance.now():Date.now();
  console.log("Performing benchmark...");
  var count = 0;
  var maxCount = MAX_PERMUTATIONS;
  unscrambleWord("aaaaaaaa",()=>{
    postMessage({cmd:"BENCHMARK_PROG",params:[++count,maxCount]})
  });
  console.log("Benchmark finished!");
  var end = typeof(performance)!="undefined"?performance.now():Date.now();

  return (end-now)/(typeof(performace)!="undefined"?1000:1);
}

function spawnWorker()
{
  if(queue.length === 0 || NUM_AVAILABLE<=0) {
    return false;
  }
  var workData = queue.shift();
  NUM_AVAILABLE--;
  worker = new Worker("code-worker.js");
  workers.push(worker);
  var keyword = workData[0];
  var code = workData[1];
  var eAnagram = workData[2];
  //console.log(`Spawning code finding worker for keyword '${keyword}'.`);
  postMessage({cmd:"START_KEYWORD",params:[keyword]})
  var worker;
  worker.addEventListener("message",onMessage);
  worker.addEventListener("error",(ev)=>{console.log("An error occurred!")});
  worker.id = keyword;
  var msg = {id:keyword,cmd:"INIT",params:[code,eAnagram,options.delay]};
  worker.postMessage(msg);
  return true;
}

function spawnWorkers()
{
  if(NUM_AVAILABLE<1) {
    return false;
  }
  while(spawnWorker()){}
  return true;
}

function onMessage(ev)
{
  var msg = ev.data;

  if(msg.cmd!="DONE") postMessage(msg);
  //if(msg.cmd!="PROG")console.log("Received message from worker for the keyword %s",msg.id,msg);

  if(msg.cmd=="DONE")
  {
    //console.log("Worker for keyword '%s' finished!",msg.id);
    postMessage({cmd:"DONE_KEYWORD",params:[msg.id]});
    var found = false;
    for(var i=0;i<workers.length;i++)
    {
      if(workers[i] instanceof Worker && workers[i].id==msg.id) {
        found=true;
        workers[i].terminate();
        workers[i]=null;
        NUM_AVAILABLE++;
        setTimeout(spawnWorker,100);
        break;
      }
    }
    if(!found) {
      console.log("Failed to find worker %s in active workers.",msg.id,workers);
    }
    if(queue.length===0 && NUM_AVAILABLE==options.max_workers) {
      console.log("Finished processing last entries");
      postMessage({cmd:"DONE",params:[]});
      ready = true;
    }
    return;
  } 
}

addEventListener("message",(ev)=>{
  var msg = ev.data,id,cmd,params;

  id = msg.id;
  cmd = msg.cmd;
  params = msg.params;
  if(!ready)
  {
    postMessage({cmd:"STATUS",params:[1,"Not ready yet."]})
    return;
  }


  if(cmd=="BENCHMARK")
  {
    postMessage({cmd:"BENCHMARK_RESULT",params:[benchmark()]});
    return;
  } else

  if(cmd=="OPT")
  {
    if(options[msg.params[0]]===undefined) {
      postMessage({cmd:"INVALID",params:[`Invalid command '${msg.cmd}: ${msg.params[0]}'`]})
    } else {
      console.log(`Changed option '${msg.params[0]}' to ${msg.params[1]}!`);
      if(msg.params[0]=="max_workers")
      {
        //options.delay = Math.max(1,15/options.max_workers)-0.5;
        NUM_AVAILABLE = Math.max(msg.params[1]-(options.max_workers-NUM_AVAILABLE),0);
      }
      options[msg.params[0]]=msg.params[1];
    }
    return;
  } else

  if(cmd=="DECODE")
  {
    ready = false;
    var cipher = params[0];
    var eAnagram = params[1];
    console.log("Decoding nuclear codes... (%s,%s)",cipher,eAnagram);
    var matchedKeywords = findKeywords(cipher);

    postMessage({cmd:"KEYWORDS",params:[matchedKeywords]});

    var i,keyword,cipher,code,possibleCodes,anagrams={};

    for(i=0;i<matchedKeywords.length;i++)
    {
      keyword = matchedKeywords[i];
      cipher  = generateCipher(keyword);
      //console.log("Cipher for %s: %s",keyword,cipher.join(""));
      code = convertWord(eAnagram,cipher);
      //console.log("Anagram for %s: %s",keyword,code);
      anagrams[keyword] = code;
      postMessage({cmd:"ANAGRAM",params:[keyword,code]});
      queue.push([keyword,code,eAnagram]);
    }
    spawnWorkers();

  }

  postMessage(msg);
});