#!/usr/bin/env node
"use module"

import tape from "tape"
import Immediate from "p-immediate"
import AsyncIterPipe, { AsyncIterPipeDoneError} from ".."

tape( "produce then consume", async function( t){
	t.plan( 2)
	const aip= new AsyncIterPipe()
	aip.produce( 111)
	aip.produce( 222)

	const
	  next1= aip.next(),
	  next2= aip.next(),
	  next3= aip.next()
	t.equal( (await next1).value, 111, "value 111 was eventually produced")
	t.equal( (await next2).value, 222, "value 222 was eventually produced")
	// TODO: sleep, validate 3 not resolved
	t.end()
})

tape( "consume then produce", async function( t){
	t.plan( 7)
	const aip= new AsyncIterPipe()
	let i= 0
	aip.next().then( cur=> {
		t.equal( cur.value, 111, "produced first value, 111")
		t.equal( i++, 0, "produced first value")
	})
	aip.next().then( cur=> {
		t.equal( i++, 1, "produced second value, 222")
		t.equal( cur.value, 222, "produced second value")
	})
	await Immediate()
	t.equal( i, 0, "saw nothing")

	aip.produce( 111)
	await Immediate()
	t.equal( i, 1, "saw first value")

	aip.produce( 222)
	await Immediate()
	t.equal( i, 2, "saw second value")
	t.end()
})

tape( "consume then end", async function( t){
	t.plan( 6)
	const aip= new AsyncIterPipe()
	aip.produce( 111)
	let next111= aip.next() // consume, successfully
	let next222= aip.next() // consume, successfully
	aip.produce( 222)
	aip.return( 42) // end
	let nextReturned= aip.next() // consume, but had ended

	next111= await next111
	t.equal( next111.value, 111, "got first value")
	t.equal( next111.done, false, "first was not done")

	next222= await next222
	t.equal( next222.value, 222, "got first value")
	t.equal( next222.done, false, "first was not done")

	nextReturned= await nextReturned
	t.equal( nextReturned.value, 42, "got return value")
	t.equal( nextReturned.done, true, "second was done")
	t.end()
})

tape( "return then consume fails", async function( t){
	t.plan( 4)
	const aip= new AsyncIterPipe()
	aip.produce( 111) // gets dropped by return
	t.equal( aip.queueCount, 1, "one write queued")


	aip.return( 42) // end
	t.equal( aip.queueCount, 0, "queued write dropped")
	let nextReturned= aip.next() // going to fail
	nextReturned= await nextReturned
	t.equal( nextReturned.value, 42, "got return value")
	t.equal( nextReturned.done, true, "second was done")
	t.end()
})

tape( "return then produce fails", async function( t){
	t.plan( 5)
	const aip= new AsyncIterPipe()
	let nextReturned= aip.next()
	t.equal( aip.queueCount, -1, "queued read")
	aip.return( 42) // end
	t.equal( aip.queueCount, 0, "dropped queued read")

	try{
		aip.produce( 678)
		t.fail( "unexpected success of produce")
	}catch( ex){
		t.ok( ex instanceof AsyncIterPipeDoneError, "got expected AsyncIterPipeDoneError from produce")
		t.equal( aip.queueCount, 0, "produce did not change queueCount")
	}

	nextReturned.catch( function( ex){
		t.ok( ex instanceof AsyncIterPipeDoneError, "got expected AsyncIterPipeDoneError from in flight AsyncIterationResult")
		t.end()
	})
})

tape( "produceAfterReturn", async function( t){
	t.plan( 4)
	const aip= new AsyncIterPipe({ produceAfterReturn: true})
	let
	  next1= aip.next(),
	  return1= aip.return( 42)
	aip.produce( 111)

	next1= await next1
	t.equal( next1.value, 111, "got 111")
	t.equal( next1.done, false, "was not done")

	return1= await return1
	t.equal( return1.value, 42, "return value")
	t.equal( return1.done, true, "return done")
	t.end()
})

tape( "count", async function( t){
	t.plan( 2)
	const aip= new AsyncIterPipe()
	let
	  read1= aip.next(),
	  read2= aip.next()
	t.equal( aip.queueCount, -2, "has two outstanding read requests")
	aip.produce( 1)
	aip.produce( 2)
	aip.produce( 3)
	aip.produce( 4)
	t.equal( aip.queueCount, 2, "has two queued writes")
	t.end()
})
