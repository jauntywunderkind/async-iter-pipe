"use module"

import tape from "tape"
import AGT from ".."
import Immediate from "p-immediate"

tape( "map", async function( t){
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

tape( "map can drop", async function( t){
	t.plan( 4)

	// filter which drops every other
	let count= -1
	function map( x){
		return count++% 2? x: AGT.DROP
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
