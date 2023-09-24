/*
	this is a keyword in javascript which repersents the object of owner which called it.

*/

function a(){
	console.log(this.name);
}

var name = 'Anil Kapoor';

const obj1 = {
	name: 'Sunita Kapoor',
	a: a
} 

const obj2 = {
	name: 'Lakshya Kapoor',
	a: a
}

a();
obj1.a();
obj2.a();