/*
	JavaScript arrays are used to store multiple values in a single variable.

	An array is a special variable, which can hold more than one value at a time.

	We can access the values by referring to an index number.

	Array literal is the easiest way to create a JavaScript Array.

	By new keyword we can also create the array.

	Array indexes start with 0. [0] is the first element. [1] is the second element.

	Arrays are a special type of objects. The typeof operator in JavaScript returns "object" for arrays.

	Arrays use numbers to access its "elements".

	Objects use names to access its "members".

	Example :-
*/

var users = ["Rohit", "Anil", "Pawan"]; // Array literal // It is fast than below line
var users = new Array("Rohit", "Anil", "Pawan"); // new keyword with Array // It is slow than above line

/*
	JavaScript variables can be objects. Arrays are special kinds of objects.
	
	Because of this, you can have variables of different types in the same Array.

	You can have objects in an Array. You can have functions in an Array. You can have arrays in an Array:
*/

myArray[0] = Date.now;
myArray[1] = myFunction;
myArray[2] = myCars;


/*
	How to check length of an array or string without use of builtin property and functions 
*/

function strLength(s) {
  var length = 0;
  while (s[length] !== undefined)
    length++;
  return length;
}

console.log(strLength("Hello")); // 5
console.log(strLength("")); // 0

/*
	Associative Arrays:  Arrays with named indexes are called associative arrays (or hashes).

	JavaScript does not support arrays with named indexes.

	In JavaScript, arrays always use numbered indexes.  
*/