const a = {
	name: 'Anil Kapoor',
	display (){
		console.log(this.name);
	}
}
a.display();
a.display.call();

const b = {
	name: 'Sunita Kapoor'
}

a.display.call(b);