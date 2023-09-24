/* 
Q.1 How to create classes in JavaScript?
 	ES6, also known as ECMAScript2015, introduced classes.
	A class is a type of function, but instead of using the keyword function to initiate it, we use the keyword class and the properties are assigned inside a constructor() method.

  	1. Class definition
  	2. Create constructor
  	3. Create object of the class

  	Use the keyword class to create a class, and always add the constructor() method.
	The constructor method is called each time the class object is initialized.
	The constructor method is called automatically when the object is initialized.
	A class have only one constructor & no method can have name like constructor.
	If you do not have a constructor method in your class. JavaScript will add an invisible and empty constructor method. Clases does not support hoisting in javascript. Every class follow the strict mode rules.

	Static Method : Static methods are defined on the class itself, and not on the prototype. 
	That means you cannot call a static method on the object (myObj), but on the class (A):

	If you want to use the object of the class inside the static method, you can send it as a parameter:
	Without creating the object of the class we can not call any method inside their other class method.

	Inheritance : To create a class inheritance, use the extends keyword. A class created with a class inheritance inherits all the methods from another class.
	To access the parent class we need to call the super() method within child class constructor. The super() method refers to the parent class. By calling the super() method in the constructor method, we call the parent's constructor method and gets access to the parent's properties and methods.
	Inheritance is useful for code reusability: reuse properties and methods of an existing class when you create a new class.

	Getters and Setters :- Classes also allows you to use getters and setters. It can be smart to use getters and setters for your properties, especially if you want to do something special with the value before returning them, or before you set them. To add getters and setters in the class, use the get and set keywords
  
*/


class A {
	constructor(){
		console.log("I am a constructor method");
	}

	print(){
		console.log("I am a normal method");
	}

	static hello(){
		console.log("I am a static method");
	}
}

//var myObj = new A();
//myObj.print();
// myObj.hello(); // Uncaught TypeError: myObj.hello is not a method
//A.hello();

class B extends A {
	constructor(){
		super();
		console.log("I am a child class constructor");
	}

	newPrint (){
		A.hello();
	}
} 

var bObj = new B();

bObj.newPrint();