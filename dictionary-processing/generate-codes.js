const fs = require('fs');

if(process.argv.length<3)
{
  console.error("Invalid usage!");
  console.log("Usage: node generate-codes.js words.txt")
  process.exit(1);
}

function alluniq(str)
{
  var used = {},i;
  for(i=0;i<str.length;i++)
  {
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

fs.writeFileSync("potential-codes.json","");
fs.writeFileSync("sorted-codes.json","");

fs.readFile(process.argv[2], 'utf8', function(err, contents)
{
  var data, count = 0,words = [];
  if(err)
  {
    console.error(err);
  }

  data = contents.split("\r\n");

  console.log("Found "+data.length+" words!");

  for(var i=0;i<data.length;i++)
  {
    if(data[i].replace(/[^a-zA-Z]+/g,"")==data[i] && data[i].length==8 && alluniq(data[i].toLowerCase()))
    {
      count++;
      words.push(data[i].toLowerCase());
    }
  }

  words = words.sort();

  console.log("Found %d 8-letter words!",count);

  fs.writeFileSync("potential-codes.json", JSON.stringify(words));

  var pairs = {};
  var sword;
  for(var i=0;i<words.length;i++)
  {
    sword = words[i].split("").sort().join("");
    if(pairs[sword]===undefined)
    {
      pairs[sword] = [];
    }
    pairs[sword].push(words[i]);
  }

  fs.writeFileSync("sorted-codes.json", JSON.stringify(pairs));
});