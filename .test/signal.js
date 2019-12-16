#!/usr/bin/env node
"use module"
/** module .test/signal.js
* test for termination signals
*/
import tape from "tape"
import Pipe, { PipeAbortError} from "../async-iter-pipe.js"

tape( "thenDone-promise then return", async function( t){
	t.plan( 1)
	const
	  pipe= new Pipe(),
	  done= pipe.thenDone
	pipe.return()
	await done
	t.pass( "became done")
	t.end()
})

tape( "thenDone-then then return", async function( t){
	t.plan( 1)
	const
	  pipe= new Pipe(),
	  done= pipe.thenDone( function(){
		t.pass( "done")
		t.end()
	  })
	pipe.return()
})

tape( "return then thenDone", async function( t){
	t.plan( 1)
	const pipe= new Pipe()
	pipe.return()
	await pipe.thenDone
	t.pass( "became done")
	t.end()
})

