// Number Sorter

let numlist = [];
let inval = 0;
const suffix = ["st", "nd", "rd"];

function inappend(numlist, suffix) {
  inval += 1;
  numlist.push(prompt(inval.toString() + suffix + " number? "));
}

inappend(numlist, suffix[0]);
inappend(numlist, suffix[1]);
inappend(numlist, suffix[2]);

if (numlist[0] > numlist[1] && numlist[0] > numlist[2]) {
  console.log(numlist[0] + " is the biggest");
} else if (numlist[1] > numlist[0] && numlist[1] > numlist[2]) {
  console.log(numlist[1] + " is the biggest");
} else if (numlist[2] > numlist[0] && numlist[2] > numlist[1]) {
  console.log(numlist[2] + " is the biggest");
}
