var a='doc:save:"asdfas"'
var reg=new RegExp('(doc:save:")(.+)(")',"gmi");

var b=a.replace(reg,"$2")

console.log(b)
var reg=new RegExp("(http://www.qidian.com/BookReader/)(\\d+),(\\d+).aspx","gmi");
var url="http://www.qidian.com/BookReader/1017141,20361055.aspx";

var rep=url.replace(reg,"$1ShowBook.aspx?bookId=$2&chapterId=$3");
console.log(rep)