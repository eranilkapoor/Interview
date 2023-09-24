/*
	What is async await ?

*/
//function hello() { return "Hello" };
//console.log(hello());

async function hello() { return "Hello" };
console.log(hello());
hello().then((value) => console.log(value));

async function hello1() {
  return greeting = await Promise.resolve("Hello");
};

hello1().then((data)=>console.log(data));