"use module"

import tape from "tape"
import AGT from ".."
import Immediate from "p-immediate"

tape( "map produce then read", async function( t){
	function map( x){
		return x* x
	}
	t.plan( 3)
	const agt= new AGT({ map})
	agt.produce( 1)
	agt.produce( 2)
	agt.produce( 3)
	agt.end()

	const
	  next1= await agt.next(),
	  next2= await agt.next(),
	  next3= await agt.next()
	t.equal( next1.value, 1)
	t.equal( next2.value, 4)
	t.equal( next3.value, 9)
	t.end()
})

tape( "map read then produce", async function( t){
	function map( x){
		return x* x
	}
	t.plan( 3)
	const agt= new AGT({ map})
	// read
	let
	  next1= agt.next(),
	  next2= agt.next(),
	  next3= agt.next()
	// produce
	agt.produce( 1)
	agt.produce( 2)
	agt.produce( 3)
	agt.end()

	// validate
	t.equal( (await next1).value, 1)
	t.equal( (await next2).value, 4)
	t.equal( (await next3).value, 9)
	t.end()
})

tape( "map can drop", async function( t){
	t.plan( 4)

	// filter which drops every other
	let count= -1
	function map( x){
		const pass= count++% 2
		return pass? x: AGT.DROP
	}
	const agt= new AGT({ map})
	await agt.produceFrom([ 0, 1, 2, 3, 4, 5])
	agt.end()

	const
	  next1= await agt.next(),
	  next2= await agt.next(),
	  next3= await agt.next(),
	  next4= await agt.next()
	t.equal( next1.value, 0)
	t.equal( next2.value, 2)
	t.equal( next3.value, 4)
	t.equal( next4.done, true)
	t.end()
})

tape.skip( "map can produce additional values", async function( t){
	t.plan( 4)

	// filter which drops every other
	function map( x){
		this.produce( x)
		return x* 2
	}
	const agt= new AGT({ map})
	await agt.produceFrom([ 1, 4, 16])
	agt.end()

	const
	  next1= await agt.next(), // 1
	  next2= await agt.next(), // *2
	  next4= await agt.next(), // 4
	  next8= await agt.next(), // *8
	  next16= await agt.next(), // 16
	  next32= await agt.next(), // *32
	  nextDone= await agt.next()
	t.equal( next1.value, 1)
	t.equal( next2.value, 2)
	t.equal( next4.value, 4)
	t.equal( next8.value, 8)
	t.equal( next16.value, 16)
	t.equal( next32.value, 32)
	t.equal( nextDone.done, true)
	t.end()
})
