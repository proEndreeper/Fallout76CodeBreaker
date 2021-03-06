const fs = require('fs');

if(process.argv.length<3)
{
  console.error("Invalid usage!");
  console.log("Usage: node generate-keywords.js words.txt")
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

fs.writeFileSync("keywords.json","");

fs.readFile(process.argv[2], 'utf8', function(err, contents)
{
  var data, count = 0,words = [];
  if(err)
  {
    console.error(err);
  }

  data = contents.split(/\r?\n/);

  console.log("Found "+data.length+" words!");

  for(var i=0;i<data.length;i++)
  {
    if(data[i].replace(/[^a-zA-Z]+/g,"")==data[i] && data[i].length>=6 && words.indexOf(data[i].toLowerCase())<0 && alluniq(data[i].toLowerCase()))
    {
      count++;
      words.push(data[i].toLowerCase());
    }
  }

  console.log("Found "+words.length+" 16-letter or less words!");

  fs.writeFileSync("keywords.json", JSON.stringify(words.sort()));
});