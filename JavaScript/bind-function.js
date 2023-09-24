const a = {
	name: 'Anil Kapoor',
	display (){
		console.log(this.name);
	}
}
a.display();
a.display.bind()();

const b = {
	name: 'Sunita Kapoor'
}

a.display.bind(b)();