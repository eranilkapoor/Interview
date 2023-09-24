/*
	Hoisting is the process of moving the declaration of variable partily and function wholy top of the releted execution context.
*/

console.log(a); // output is undefined
var a = 10;
console.log(a); // output is 10
console.log(fullname()); // output is Anil Kapoor
function fullname(){
	return 'Anil Kapoor';
}

/*
	Hoisting works only for variable defined as a global variable or declared with var, not work with let & const.
	Hoisting works only for function declaration not for function expression.
*/

// Function declaration 
function fullname(){
	return 'Anil Kapoor';
}

// Function expression 
var fullname = function(){
	return 'Anil Kapoor';
}

// If we declare varible more than one time by same name through var keyword in javascript it works like as below

console.log(b); // output is undefined

var b = 10;
console.log(b); // output is 10

var b = 20;
console.log(b); // output is 20 

// But if we declare function with same name it will overrite the all above same name functions with last declared same name function.

console.log(a()); // Output is 20
function a(){
	return 10;
}
console.log(a()); // Output is 20
function a(){
	return 20;
}
console.log(a()); // Output is 20

// Hoisting takes place on every execution context 

var favColor = 'Blue';
function myColor(){
	console.log('My favurite color is : '+ favColor);

	var favColor = 'Green';

	console.log('My new favurite color is : '+ favColor);
}

myColor();
// output is 
// My favurite color is : undefined
// My new favurite color is : Green

///////////////////////////////////
function bigBrother(){
  function littleBrother() {
    return 'it is me!';
  }
  return littleBrother();
  function littleBrother() {
    return 'no me!';
  }
}

// Before running this code, what do you think the output is?
bigBrother();
// Output is // no me!